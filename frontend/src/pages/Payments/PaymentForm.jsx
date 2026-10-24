import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Modal from '../../components/UI/Modal';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { getParties } from '../../api/parties';
import { createPayment } from '../../api/payments';
import { CURRENCIES, PAYMENT_METHODS } from '../../utils/formatters';

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

  const {
    register,
    handleSubmit,
    reset,
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

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      const payload = {
        ...data,
        bankReference: data.referenceNumber || '',
        allocations: [],
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
