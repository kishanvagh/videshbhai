import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Modal from '../../components/UI/Modal';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { getParties, getPartyBalances } from '../../api/parties';
import { createPayment, getOutstandingByParty } from '../../api/payments';
import { CURRENCIES, PAYMENT_METHODS, formatCurrency } from '../../utils/formatters';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const paymentSchema = z.object({
  party: z.string().min(1, 'Please select a customer / party'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  amountReceived: z.coerce.number().positive('Amount received must be greater than 0'),
  currency: z.string().min(1, 'Please select payment currency'),
  paymentMethod: z.string().min(1, 'Please select payment method'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export default function PaymentForm({ isOpen, onClose, onSuccess, initialPartyId, initialCurrency }) {
  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [partyOutstanding, setPartyOutstanding] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [targetCurrency, setTargetCurrency] = useState('');
  const [exchangeRateInput, setExchangeRateInput] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      party: initialPartyId || '',
      paymentDate: new Date().toISOString().split('T')[0],
      amountReceived: '',
      currency: initialCurrency || 'USD',
      paymentMethod: 'bank_transfer',
      referenceNumber: '',
      notes: '',
    },
  });

  // Load parties on open
  useEffect(() => {
    if (isOpen) {
      setLoadingParties(true);
      getParties({ limit: 100 })
        .then((res) => {
          const list = res.data.data?.parties || res.data.data || res.data || [];
          setParties(Array.isArray(list) ? list : []);
        })
        .catch(() => toast.error('Failed to load parties'))
        .finally(() => setLoadingParties(false));

      reset({
        party: initialPartyId || '',
        paymentDate: new Date().toISOString().split('T')[0],
        amountReceived: '',
        currency: initialCurrency || 'USD',
        paymentMethod: 'bank_transfer',
        referenceNumber: '',
        notes: '',
      });
    }
  }, [isOpen, initialPartyId, initialCurrency, reset]);

  // Fetch outstanding when party changes
  const selectedParty = watch('party');
  const payCurrency = watch('currency');
  const amountReceivedVal = parseFloat(watch('amountReceived') || 0);

  useEffect(() => {
    if (selectedParty) {
      getPartyBalances(selectedParty)
        .then(res => {
          const balances = res.data?.data?.balances || res.data?.balances || [];
          setPartyOutstanding(balances);
        })
        .catch(() => setPartyOutstanding(null));

      getOutstandingByParty(selectedParty)
        .then((res) => {
          const list = res.data?.data || res.data || [];
          const flat = (Array.isArray(list) ? list : []).map((inv) => {
            const sale = inv.sale && typeof inv.sale === 'object' ? inv.sale : inv || {};
            const out = inv.outstanding && typeof inv.outstanding === 'object' ? inv.outstanding : {};
            const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && parseFloat(sale.saleAmountForeign || 0) > 0;
            const currency = isForeign ? sale.foreignCurrency : 'INR';
            const outstanding = parseFloat(isForeign ? (out.outstandingForeign ?? 0) : (out.outstandingINR ?? 0)) || 0;
            return {
              _id: sale._id || sale.id || inv._id || inv.id,
              invoiceNumber: sale.invoiceNumber || '',
              saleDate: sale.saleDate,
              currency,
              outstanding,
            };
          });
          setInvoices(flat.filter((i) => i._id && i.outstanding > 0));
        })
        .catch(() => setInvoices([]));
    } else {
      setPartyOutstanding(null);
      setInvoices([]);
    }
  }, [selectedParty]);

  // Distinct currencies with outstanding dues, excluding the payment currency.
  const otherCurrencies = [...new Set(
    invoices.filter((i) => i.currency !== payCurrency && i.outstanding > 0).map((i) => i.currency)
  )];
  const sameCurrencyInvoices = invoices.filter((i) => i.currency === payCurrency && i.outstanding > 0);
  const crossAvailable = otherCurrencies.length > 0;

  // Default the "reduce due in" currency to the other currency with the largest outstanding.
  useEffect(() => {
    const otherTotals = {};
    invoices.forEach((i) => {
      if (i.currency !== payCurrency && i.outstanding > 0) {
        otherTotals[i.currency] = (otherTotals[i.currency] || 0) + i.outstanding;
      }
    });
    const opts = Object.keys(otherTotals);
    if (opts.length === 0) return;
    if (!targetCurrency || !opts.includes(targetCurrency)) {
      const best = opts.slice().sort((a, b) => (otherTotals[b] || 0) - (otherTotals[a] || 0))[0];
      setTargetCurrency(best);
    }
  }, [invoices, payCurrency]); // eslint-disable-line

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      const numericAmount = parseFloat(data.amountReceived) || 0;
      const rate = parseFloat(exchangeRateInput) || 0;
      const allocations = [];
      // Pay toward invoices in another currency? Then a manual exchange rate is
      // required and the converted amount reduces the party's due.
      const targetCurr = (crossAvailable && targetCurrency && targetCurrency !== data.currency) ? targetCurrency : null;

      if (targetCurr && rate > 0) {
        const targetInvoices = invoices
          .filter((i) => i.currency === targetCurr && i.outstanding > 0)
          .sort((a, b) => new Date(a.saleDate) - new Date(b.saleDate));
        let remainingSettlement = numericAmount * rate; // in target (invoice) currency
        for (const inv of targetInvoices) {
          if (remainingSettlement <= 0.001) break;
          const settled = Math.min(inv.outstanding, remainingSettlement);
          if (settled <= 0.001) continue;
          allocations.push({
            sale: inv._id,
            allocatedAmount: round2(settled / rate),
            isCrossCurrency: true,
            exchangeRateUsed: rate,
            settlementAmountInSaleCurrency: round2(settled),
          });
          remainingSettlement -= settled;
        }

        // Guard against rounding drift pushing the total allocation above the payment amount.
        const allocTotal = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
        if (allocTotal > numericAmount + 0.0001 && allocations.length > 0) {
          const diff = allocTotal - numericAmount;
          const last = allocations[allocations.length - 1];
          last.allocatedAmount = round2(Math.max(0, last.allocatedAmount - diff));
        }
      } else if (sameCurrencyInvoices.length === 0 && crossAvailable && numericAmount > 0) {
        toast.error(
          `This payment is in ${data.currency} but the party's dues are in ${otherCurrencies.join(', ')}. ` +
          `Enter the exchange rate (1 ${data.currency} = ? ${targetCurrency}) to apply it to the due.`
        );
        setSubmitting(false);
        return;
      }

      const payload = {
        ...data,
        bankReference: data.referenceNumber || '',
        allocations,
      };
      await createPayment(payload);
      toast.success('Payment recorded successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment Received" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Party */}
          <div>
            <label className="label">Customer / Party *</label>
            <select className="input" {...register('party')} disabled={loadingParties}>
              <option value="">{loadingParties ? 'Loading...' : '-- Select Party --'}</option>
              {parties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.country || 'India'})
                </option>
              ))}
            </select>
            {errors.party && <p className="text-red-500 text-xs mt-1">{errors.party.message}</p>}
            {partyOutstanding && partyOutstanding.length > 0 && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1">Outstanding Due:</p>
                {partyOutstanding.filter(b => b.outstanding > 0).map(b => (
                  <div key={b.currency} className="flex justify-between text-xs">
                    <span className="text-amber-700">{b.currency}:</span>
                    <span className="font-bold text-red-600">{b.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {partyOutstanding.every(b => b.outstanding <= 0) && (
                  <p className="text-xs text-green-600 font-medium">✓ No outstanding balance</p>
                )}
              </div>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="label">Payment Date *</label>
            <input type="date" className="input" {...register('paymentDate')} />
            {errors.paymentDate && <p className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</p>}
          </div>

          {/* Amount & Currency */}
          <div>
            <label className="label">Amount Received *</label>
            <div className="flex gap-2">
              <select className="input w-28 flex-shrink-0" {...register('currency')}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="5000.00"
                className="input font-semibold text-slate-800 flex-1"
                {...register('amountReceived')}
              />
            </div>
            {errors.amountReceived && <p className="text-red-500 text-xs mt-1">{errors.amountReceived.message}</p>}
          </div>

          {/* Cross-currency payment: party's due is in another currency */}
          {crossAvailable && (
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-3">
              <p className="text-xs font-semibold text-blue-800">
                ⚠️ This party's due is in {otherCurrencies.join(', ')} but you're recording a {payCurrency} payment.
                Enter the exchange rate so the payment reduces the due.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Reduce due in</label>
                  <select
                    className="input"
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value)}
                  >
                    {otherCurrencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">1 {payCurrency} = ? {targetCurrency}</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="e.g. 1.12"
                    className="input font-semibold"
                    value={exchangeRateInput}
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                  />
                </div>
              </div>
              {amountReceivedVal > 0 && parseFloat(exchangeRateInput) > 0 && targetCurrency && (
                <p className="text-xs text-blue-700">
                  {formatCurrency(amountReceivedVal, payCurrency)} at 1 {payCurrency} = {parseFloat(exchangeRateInput)} {targetCurrency} reduces the {targetCurrency} due by{' '}
                  <span className="font-bold">{formatCurrency(amountReceivedVal * parseFloat(exchangeRateInput), targetCurrency)}</span>.
                </p>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="label">Payment Method *</label>
            <select className="input" {...register('paymentMethod')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {errors.paymentMethod && <p className="text-red-500 text-xs mt-1">{errors.paymentMethod.message}</p>}
          </div>

          {/* Reference Number */}
          <div>
            <label className="label">Bank / Wire Reference</label>
            <input
              type="text"
              placeholder="e.g. WIRE-889312 or UTR/Cheque #"
              className="input"
              {...register('referenceNumber')}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes / Remarks</label>
            <input
              type="text"
              placeholder="Received from Dubai branch"
              className="input"
              {...register('notes')}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting && <LoadingSpinner size="sm" />}
            Save Payment Record
          </button>
        </div>
      </form>
    </Modal>
  );
}
