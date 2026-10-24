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
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

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
      referenceNumber: '',
      notes: '',
    },
  });

  const selectedCurrency = watch('foreignCurrency');
  const foreignAmount = parseFloat(watch('foreignAmountExchanged') || 0);
  const rate = parseFloat(watch('exchangeRate') || 0);
  const charges = parseFloat(watch('bankCharges') || 0);
  const netReceived = parseFloat(watch('netINRReceived') || 0);

  const calculatedGross = foreignAmount * rate;
  const calculatedNet = Math.max(0, calculatedGross - charges);
  const diffFromCalculated = netReceived ? netReceived - calculatedNet : 0;

  // Load balances and parties
  useEffect(() => {
    if (isOpen) {
      getParties({ limit: 100 })
        .then((res) => setParties(res.data.data?.parties || res.data.data || res.data || []))
        .catch(() => {});

      getCurrencyBalances()
        .then((res) => {
          const list = res.data.data || res.data || [];
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
          referenceNumber: exchange.referenceNumber || '',
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
      const payload = {
        ...data,
        grossINR: calculatedGross,
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

        {/* Optional Party & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
