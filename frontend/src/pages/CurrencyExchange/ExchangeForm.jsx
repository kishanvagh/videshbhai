import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Calculator, AlertCircle, ArrowRight } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { getParties } from '../../api/parties';
import { createExchange, updateExchange, getCurrencyBalances } from '../../api/exchanges';
import { CURRENCIES, formatCurrency, formatINR } from '../../utils/formatters';

const exchangeSchema = z.object({
  foreignCurrency: z.string().min(1, 'Please select foreign currency'),
  foreignAmountExchanged: z.coerce.number().positive('Amount must be greater than 0'),
  exchangeRate: z.coerce.number().positive('Exchange rate must be greater than 0'),
  bankCharges: z.coerce.number().min(0, 'Bank charges must be 0 or more').default(0),
  netINRReceived: z.coerce.number().positive('Net INR received must be greater than 0'),
  exchangeDate: z.string().min(1, 'Exchange date is required'),
  party: z.string().optional(),
  exchangePartyName: z.string().min(1, 'Currency exchange party name is required'),
  paymentReceivedPercent: z.coerce.number().min(0, 'Percent must be 0 or more').max(100, 'Percent cannot exceed 100').default(100),
  inrReceivedAmount: z.coerce.number().min(0, 'INR received cannot be negative').default(0),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Quick-select options for how much of the exchange INR payment has been received
const PERCENT_OPTIONS = [
  { value: 100, label: 'Full (100%)' },
  { value: 75, label: '75%' },
  { value: 50, label: '50%' },
  { value: 25, label: '25%' },
  { value: 0, label: 'Pending (0%)' },
];

export default function ExchangeForm({ isOpen, onClose, exchange, onSuccess }) {
  const [parties, setParties] = useState([]);
  const [balances, setBalances] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(exchangeSchema),
    defaultValues: {
      foreignCurrency: 'USD',
      foreignAmountExchanged: '',
      exchangeRate: '',
      bankCharges: 0,
      netINRReceived: '',
      exchangeDate: new Date().toISOString().split('T')[0],
      party: '',
      exchangePartyName: '',
      paymentReceivedPercent: 100,
      inrReceivedAmount: 0,
      referenceNumber: '',
      notes: '',
    },
  });

  const selectedCurrency = watch('foreignCurrency');
  const foreignAmount = parseFloat(watch('foreignAmountExchanged') || 0);
  const rate = parseFloat(watch('exchangeRate') || 0);
  const charges = parseFloat(watch('bankCharges') || 0);
  const netReceived = parseFloat(watch('netINRReceived') || 0);
  const receivedPercent = parseFloat(watch('paymentReceivedPercent') || 0);
  const manualInrReceived = parseFloat(watch('inrReceivedAmount') || 0);
  const inrReceived = manualInrReceived > 0
    ? Math.min(netReceived, parseFloat(manualInrReceived.toFixed(2)) || 0)
    : Math.min(netReceived, parseFloat((netReceived * receivedPercent / 100).toFixed(2)) || 0);
  const inrPendingAmount = Math.max(0, parseFloat((netReceived - inrReceived).toFixed(2)));

  const calculatedGross = foreignAmount * rate;
  const calculatedNet = Math.max(0, calculatedGross - charges);
  const diffFromCalculated = netReceived ? netReceived - calculatedNet : 0;

  // Keep the manual "INR received" amount in sync whenever the total INR changes
  // (e.g. auto-calculated from amount/rate/charges)
  useEffect(() => {
    if (netReceived > 0) {
      const pctVal = parseFloat(watch('paymentReceivedPercent') || 0);
      setValue('inrReceivedAmount', parseFloat((netReceived * pctVal / 100).toFixed(2)));
    } else {
      setValue('inrReceivedAmount', 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netReceived]);

  // Load balances and parties
  useEffect(() => {
    if (isOpen) {
      getParties({ limit: 100 })
        .then((res) => setParties(res.data.data?.parties || res.data.data || res.data || []))
        .catch(() => {});

      getCurrencyBalances()
        .then((res) => {
          const data = res.data.data || res.data || {};
          // Use `holdings` (foreign only) for the exchange balance validation
          const list = data.holdings || (Array.isArray(data) ? data : []);
          const map = {};
          if (Array.isArray(list)) {
            list.forEach((item) => {
              map[item.currency] = item.currentHolding ?? item.currentBalance ?? item.balance ?? 0;
            });
          }
          setBalances(map);
        })
        .catch(() => {});

      if (exchange) {
        reset({
          foreignCurrency: exchange.foreignCurrency || 'USD',
          foreignAmountExchanged: exchange.foreignAmountExchanged ?? exchange.amount ?? '',
          exchangeRate: exchange.exchangeRate ?? exchange.rate ?? '',
          bankCharges: exchange.bankCharges ?? exchange.charges ?? 0,
          netINRReceived: exchange.netINRReceived ?? exchange.netINR ?? '',
          exchangeDate: exchange.exchangeDate ? new Date(exchange.exchangeDate).toISOString().split('T')[0] : '',
          party: exchange.party?._id || exchange.party || '',
          exchangePartyName: exchange.exchangePartyName || '',
          paymentReceivedPercent: exchange.paymentReceivedPercent ?? 100,
          inrReceivedAmount: exchange.inrReceivedAmount ?? 0,
          referenceNumber: exchange.referenceNumber || exchange.bankReference || '',
          notes: exchange.notes || '',
        });
      } else {
        reset({
          foreignCurrency: 'USD',
          foreignAmountExchanged: '',
          exchangeRate: '',
          bankCharges: 0,
          netINRReceived: '',
          exchangeDate: new Date().toISOString().split('T')[0],
          party: '',
          exchangePartyName: '',
          paymentReceivedPercent: 100,
          inrReceivedAmount: 0,
          referenceNumber: '',
          notes: '',
        });
      }
    }
  }, [isOpen, exchange, reset]);

  // Auto calculate net INR when amount, rate, or charges change if netINRReceived hasn't been manually typed
  const handleAutoFillNet = () => {
    if (calculatedNet > 0) {
      setValue('netINRReceived', parseFloat(calculatedNet.toFixed(2)));
    }
  };

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      const pct = Math.min(100, Math.max(0, parseFloat(data.paymentReceivedPercent) || 0));
      const netInr = parseFloat(data.netINRReceived) || 0;
      // Manual INR-received entry takes precedence; otherwise derive from percent
      const manualRecv = Math.min(netInr, Math.max(0, parseFloat(data.inrReceivedAmount) || 0));
      const inrRecv = manualRecv > 0
        ? parseFloat(manualRecv.toFixed(2))
        : Math.min(netInr, parseFloat((netInr * pct / 100).toFixed(2)) || 0);
      const payload = {
        ...data,
        grossINR: calculatedGross,
        inrReceivedAmount: inrRecv,
        inrPendingAmount: Math.max(0, parseFloat((netInr - inrRecv).toFixed(2))),
      };

      if (exchange?._id) {
        await updateExchange(exchange._id, payload);
        toast.success('Exchange record updated successfully');
      } else {
        await createExchange(payload);
        toast.success('Currency conversion recorded successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record currency exchange');
    } finally {
      setSubmitting(false);
    }
  };

  const availableBalance = balances[selectedCurrency] ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={exchange ? 'Edit Currency Conversion' : 'Record Foreign Currency Conversion'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Currency & Available Balance Header */}
        <div className="p-3 bg-gold-50/70 border border-gold-200/80 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-500">Available {selectedCurrency} Balance: </span>
            <span className="font-bold text-slate-800 text-sm">
              {formatCurrency(availableBalance, selectedCurrency)}
            </span>
          </div>
          {foreignAmount > availableBalance && availableBalance > 0 && (
            <span className="text-amber-700 font-medium">⚠️ Exceeds current recorded balance</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Currency */}
          <div>
            <label className="label">Foreign Currency *</label>
            <select className="input" {...register('foreignCurrency')}>
              {CURRENCIES.filter((c) => c !== 'INR').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.foreignCurrency && <p className="text-red-500 text-xs mt-1">{errors.foreignCurrency.message}</p>}
          </div>

          {/* Exchange Date */}
          <div>
            <label className="label">Conversion Date *</label>
            <input type="date" className="input" {...register('exchangeDate')} />
            {errors.exchangeDate && <p className="text-red-500 text-xs mt-1">{errors.exchangeDate.message}</p>}
          </div>

          {/* Amount to Convert */}
          <div>
            <label className="label">Amount to Exchange ({selectedCurrency}) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="1000.00"
              className="input font-semibold"
              {...register('foreignAmountExchanged')}
              onChange={(e) => {
                register('foreignAmountExchanged').onChange(e);
                const amt = parseFloat(e.target.value) || 0;
                const r = parseFloat(watch('exchangeRate')) || 0;
                const ch = parseFloat(watch('bankCharges')) || 0;
                if (amt > 0 && r > 0) {
                  setValue('netINRReceived', parseFloat((amt * r - ch).toFixed(2)));
                }
              }}
            />
            {errors.foreignAmountExchanged && (
              <p className="text-red-500 text-xs mt-1">{errors.foreignAmountExchanged.message}</p>
            )}
          </div>

          {/* Rate */}
          <div>
            <label className="label">Exchange Rate (₹ per 1 {selectedCurrency}) *</label>
            <input
              type="number"
              step="0.0001"
              placeholder="83.50"
              className="input font-semibold"
              {...register('exchangeRate')}
              onChange={(e) => {
                register('exchangeRate').onChange(e);
                const r = parseFloat(e.target.value) || 0;
                const amt = parseFloat(watch('foreignAmountExchanged')) || 0;
                const ch = parseFloat(watch('bankCharges')) || 0;
                if (amt > 0 && r > 0) {
                  setValue('netINRReceived', parseFloat((amt * r - ch).toFixed(2)));
                }
              }}
            />
            {errors.exchangeRate && <p className="text-red-500 text-xs mt-1">{errors.exchangeRate.message}</p>}
          </div>

          {/* Bank Charges */}
          <div>
            <label className="label">Bank Charges / Fees (₹)</label>
            <input
              type="number"
              step="0.01"
              placeholder="250.00"
              className="input"
              {...register('bankCharges')}
              onChange={(e) => {
                register('bankCharges').onChange(e);
                const ch = parseFloat(e.target.value) || 0;
                const amt = parseFloat(watch('foreignAmountExchanged')) || 0;
                const r = parseFloat(watch('exchangeRate')) || 0;
                if (amt > 0 && r > 0) {
                  setValue('netINRReceived', parseFloat((amt * r - ch).toFixed(2)));
                }
              }}
            />
            {errors.bankCharges && <p className="text-red-500 text-xs mt-1">{errors.bankCharges.message}</p>}
          </div>

          {/* Net INR Received */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label mb-0">Net INR Received (₹) *</label>
              {calculatedNet > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFillNet}
                  className="text-[10px] text-gold-600 hover:underline font-semibold"
                >
                  Recalculate
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="83250.00"
              className="input font-bold text-slate-800"
              {...register('netINRReceived')}
            />
            {errors.netINRReceived && <p className="text-red-500 text-xs mt-1">{errors.netINRReceived.message}</p>}
          </div>
        </div>

        {/* Calculation Preview */}
        {foreignAmount > 0 && rate > 0 && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Equivalent:</span>
              <span className="font-semibold text-slate-700">{formatINR(calculatedGross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Less Bank Fees:</span>
              <span className="font-semibold text-red-600">-{formatINR(charges)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold">
              <span className="text-slate-800">Calculated Net INR:</span>
              <span className="text-green-600">{formatINR(calculatedNet)}</span>
            </div>
            {diffFromCalculated !== 0 && (
              <p className="text-[11px] text-amber-700 pt-1">
                Note: Custom entered Net INR differs from calculation by {formatINR(diffFromCalculated)}.
              </p>
            )}
          </div>
        )}

        {/* INR Payment Received Tracker */}
        <div className="p-3 rounded-xl border border-green-200/80 bg-green-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-700">INR Payment Received from Exchange Party</p>
              <p className="text-[11px] text-gray-500">How much of the total exchange amount have you received back? (Full payment, 50%, etc.)</p>
            </div>
            <ArrowRight size={16} className="text-green-500" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PERCENT_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  setValue('paymentReceivedPercent', p.value);
                  if (netReceived > 0) setValue('inrReceivedAmount', parseFloat((netReceived * p.value / 100).toFixed(2)));
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  receivedPercent === p.value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-slate-600 border-gray-200 hover:border-green-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="100"
              className="input w-24 text-xs font-bold"
              {...register('paymentReceivedPercent', {
                onChange: (e) => {
                  const pctVal = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                  if (netReceived > 0) setValue('inrReceivedAmount', parseFloat((netReceived * pctVal / 100).toFixed(2)));
                },
              })}
            />
            <span className="text-xs text-gray-500">% received</span>
            {errors.paymentReceivedPercent && (
              <p className="text-red-500 text-xs ml-1">{errors.paymentReceivedPercent.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Or type INR received manually:</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="40000.00"
                className="input pl-8 w-40 text-xs font-bold"
                {...register('inrReceivedAmount', {
                  onChange: (e) => {
                    const amtVal = Math.min(netReceived, Math.max(0, parseFloat(e.target.value) || 0));
                    if (netReceived > 0) {
                      setValue('paymentReceivedPercent', Math.min(100, Math.max(0, parseFloat((amtVal / netReceived * 100).toFixed(0)))));
                    }
                  },
                })}
              />
            </div>
            {errors.inrReceivedAmount && <p className="text-red-500 text-xs">{errors.inrReceivedAmount.message}</p>}
          </div>

          {netReceived > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white border border-gray-200 p-2">
                <p className="text-[10px] text-gray-400">Total INR</p>
                <p className="text-xs font-bold text-slate-800">{formatINR(netReceived)}</p>
              </div>
              <div className="rounded-lg bg-green-100 border border-green-200 p-2">
                <p className="text-[10px] text-green-700">Received</p>
                <p className="text-xs font-bold text-green-700">{formatINR(inrReceived)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                <p className="text-[10px] text-amber-700">Pending</p>
                <p className="text-xs font-bold text-amber-700">{formatINR(inrPendingAmount)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Optional Party & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Currency Exchange Party (who gives you INR) *</label>
            <input
              type="text"
              placeholder="e.g. M/s Sunrise Forex (Kolkata)"
              className="input text-xs font-semibold"
              {...register('exchangePartyName')}
            />
            <p className="text-[11px] text-gray-400 mt-1">You give them {selectedCurrency}, they give you INR.</p>
            {errors.exchangePartyName && <p className="text-red-500 text-xs mt-1">{errors.exchangePartyName.message}</p>}
          </div>

          <div>
            <label className="label">Associated Party (Optional)</label>
            <select className="input text-xs" {...register('party')}>
              <option value="">-- None / General FX --</option>
              {parties.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Bank Reference / Deal ID</label>
            <input
              type="text"
              placeholder="e.g. HDFC-FX-99214"
              className="input text-xs"
              {...register('referenceNumber')}
            />
          </div>
        </div>

        <div>
          <label className="label">Notes / Remarks</label>
          <textarea
            rows="2"
            placeholder="Converted wire remittance through treasury desk"
            className="input text-xs"
            {...register('notes')}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting && <LoadingSpinner size="sm" />}
            {exchange ? 'Update Exchange' : 'Save Conversion'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
