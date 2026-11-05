import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Info, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../../components/UI/Modal';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { getParties } from '../../api/parties';
import { createSale, updateSale } from '../../api/sales';
import { CURRENCIES } from '../../utils/formatters';

const saleSchema = z.object({
  party: z.string().min(1, 'Please select a customer / party'),
  invoiceNumber: z.string().optional(),
  saleDate: z.string().min(1, 'Sale date is required'),
  productName: z.string().min(2, 'Product name must be at least 2 characters'),
  productDescription: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1').default(1),
  foreignCurrency: z.string().min(1, 'Please select a currency'),
  saleAmountForeign: z.coerce.number().positive('Sale price must be greater than 0'),
  estimatedProfitForeign: z.coerce.number().min(0, 'Estimated profit must be 0 or more').default(0),
  homePriceCurrency: z.enum(['INR', 'USD']).default('INR'),
  saleAmountINR: z.coerce.number().min(0, 'Home price must be 0 or more').default(0),
  notes: z.string().optional(),
});

export default function SaleForm({ isOpen, onClose, sale, onSuccess }) {
  const [salesParties, setSalesParties] = useState([]);
  const [exchangeParties, setExchangeParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      party: '',
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      saleDate: new Date().toISOString().split('T')[0],
      productName: '',
      productDescription: '',
      quantity: 1,
      foreignCurrency: 'USD',
      saleAmountForeign: '',
      estimatedProfitForeign: 0,
      homePriceCurrency: 'INR',
      saleAmountINR: '',
      notes: '',
    },
  });

  const selectedCurrency = watch('foreignCurrency');
  const homePriceCurrency = watch('homePriceCurrency');

  const loadParties = async () => {
    try {
      setLoadingParties(true);
      const res = await getParties({ limit: 200 });
      const partyList = res.data.data?.parties || res.data.data || res.data || [];
      setSalesParties(partyList.filter(p => !p.partyType || p.partyType === 'sales'));
      setExchangeParties(partyList.filter(p => p.partyType === 'exchange'));
    } catch {
      toast.error('Failed to load parties list');
    } finally {
      setLoadingParties(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadParties();
      if (sale) {
        reset({
          party: sale.party?._id || sale.party || '',
          invoiceNumber: sale.invoiceNumber || '',
          saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '',
          productName: sale.productName || sale.itemDetails?.name || '',
          productDescription: sale.productDescription || sale.itemDetails?.description || '',
          quantity: sale.quantity || 1,
          foreignCurrency: sale.foreignCurrency || sale.currency || 'USD',
          saleAmountForeign: sale.saleAmountForeign ?? sale.amountForeign ?? '',
          estimatedProfitForeign: sale.estimatedProfitForeign ?? sale.profitForeign ?? 0,
          homePriceCurrency: sale.homePriceCurrency || 'INR',
          saleAmountINR: sale.saleAmountINR ?? sale.amountINR ?? '',
          notes: sale.notes || '',
        });
      } else {
        reset({
          party: '',
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          saleDate: new Date().toISOString().split('T')[0],
          productName: '',
          productDescription: '',
          quantity: 1,
          foreignCurrency: 'USD',
          saleAmountForeign: '',
          estimatedProfitForeign: 0,
          homePriceCurrency: 'INR',
          saleAmountINR: '',
          notes: '',
        });
      }
    }
  }, [isOpen, sale, reset]);

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      if (sale?._id) {
        await updateSale(sale._id, data);
        toast.success('Sale invoice updated successfully');
      } else {
        await createSale(data);
        toast.success('Sale recorded successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save sale record');
    } finally {
      setSubmitting(false);
    }
  };

  const noSalesParties = !loadingParties && salesParties.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sale ? 'Edit Sale Invoice' : 'Record New Jewelry Sale'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Note Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">USD-First Recording:</span> Sale price and estimated profit are recorded in <span className="underline font-semibold">USD</span>. The optional <span className="underline font-semibold">Home Price</span> below tracks the domestic (INR) market value for reference only.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Party Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0 flex items-center gap-1.5">
                <Users size={13} className="text-gold-500" />
                Sale Party *
              </label>
              <Link
                to="/parties"
                onClick={onClose}
                className="text-xs text-gold-600 hover:text-gold-700 font-medium underline underline-offset-2"
              >
                + Add party from Parties menu
              </Link>
            </div>

            {noSalesParties ? (
              <div className="p-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-center">
                <p className="text-xs text-amber-700 font-medium">No sales parties found.</p>
                <Link
                  to="/parties"
                  onClick={onClose}
                  className="mt-1 inline-block text-xs text-gold-600 hover:text-gold-700 font-semibold underline"
                >
                  Go to Parties → Add Sales Party
                </Link>
              </div>
            ) : (
              <select className="input" {...register('party')} disabled={loadingParties}>
                <option value="">
                  {loadingParties ? 'Loading parties...' : '-- Select Sale Party --'}
                </option>
                {salesParties.length > 0 && (
                  <optgroup label="── Sale Parties (Customers)">
                    {salesParties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.country || 'India'})
                      </option>
                    ))}
                  </optgroup>
                )}
                {exchangeParties.length > 0 && (
                  <optgroup label="── Exchange Parties (Forex Agents)">
                    {exchangeParties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.country || 'India'}) [Exchange]
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            {errors.party && <p className="text-red-500 text-xs mt-1">{errors.party.message}</p>}
          </div>

          {/* Invoice Number */}
          <div>
            <label className="label">Invoice Number</label>
            <input type="text" className="input" {...register('invoiceNumber')} placeholder="INV-00123" />
            {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1">{errors.invoiceNumber.message}</p>}
          </div>

          {/* Sale Date */}
          <div>
            <label className="label">Sale Date *</label>
            <input type="date" className="input" {...register('saleDate')} />
            {errors.saleDate && <p className="text-red-500 text-xs mt-1">{errors.saleDate.message}</p>}
          </div>

          {/* Quantity */}
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" step="1" className="input" {...register('quantity')} />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Product Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. 22K Gold Polki Choker Necklace"
              {...register('productName')}
            />
            {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="label">Product Description / Specs</label>
            <textarea
              rows="2"
              className="input"
              placeholder="Purity: 22K, Gross Wt: 45.2g, Net Gold: 40.5g, Diamonds: 2.5ct"
              {...register('productDescription')}
            />
          </div>
        </div>

        {/* Price & Valuation */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Price &amp; Valuation (USD)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Sale Price ({selectedCurrency}) *</label>
              <div className="flex gap-2">
                <select className="input w-28 flex-shrink-0" {...register('foreignCurrency')}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="3000.00"
                  className="input font-semibold text-slate-800 flex-1"
                  {...register('saleAmountForeign')}
                />
              </div>
              {errors.saleAmountForeign && <p className="text-red-500 text-xs mt-1">{errors.saleAmountForeign.message}</p>}
            </div>

            <div>
              <label className="label">Estimated Profit ({selectedCurrency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="420.00"
                className="input font-semibold text-slate-800"
                {...register('estimatedProfitForeign')}
              />
              {errors.estimatedProfitForeign && <p className="text-red-500 text-xs mt-1">{errors.estimatedProfitForeign.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Home Price — Optional</label>
                <span className="text-[10px] text-gray-400 font-medium">Domestic market value (choose INR or USD)</span>
              </div>
              <div className="flex gap-2">
                <select className="input w-28 flex-shrink-0" {...register('homePriceCurrency')}>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    {homePriceCurrency === 'USD' ? '$' : '₹'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="250000"
                    className="input pl-8 w-full"
                    {...register('saleAmountINR')}
                  />
                </div>
              </div>
              {errors.saleAmountINR && <p className="text-red-500 text-xs mt-1">{errors.saleAmountINR.message}</p>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes / Remarks</label>
          <textarea
            rows="2"
            className="input"
            placeholder="Custom design order, delivery due in 10 days"
            {...register('notes')}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || noSalesParties} className="btn-primary flex items-center gap-2">
            {submitting && <LoadingSpinner size="sm" />}
            {sale ? 'Update Invoice' : 'Save Sale Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
