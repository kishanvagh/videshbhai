import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus, Undo2, AlertCircle } from 'lucide-react';
import Modal from '../../components/UI/Modal';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import StatusBadge from '../../components/UI/StatusBadge';
import { getAllocations, createAllocation, reverseAllocation } from '../../api/allocations';
import { getOutstandingByParty, flattenOutstandingInvoices } from '../../api/payments';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function AllocationView({ isOpen, onClose, payment, onUpdated }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocationToReverse, setAllocationToReverse] = useState(null);
  const [reversing, setReversing] = useState(false);

  // New allocation mode
  const [isAdding, setIsAdding] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [newAllocAmount, setNewAllocAmount] = useState('');
  const [savingAlloc, setSavingAlloc] = useState(false);
  const [exchangeRateInput, setExchangeRateInput] = useState('');

  const fetchAllocations = async () => {
    if (!payment?._id) return;
    try {
      setLoading(true);
      const res = await getAllocations({ payment: payment._id });
      const data = res.data.data || res.data || [];
      setAllocations(Array.isArray(data) ? data : data.allocations || []);
    } catch {
      toast.error('Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && payment) {
      fetchAllocations();
      setIsAdding(false);
    }
  }, [isOpen, payment]);

  const currency = payment?.currency || 'USD';
  const totalReceived = parseFloat(payment?.amountReceived || payment?.amount || 0);
  const currentTotalAllocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.allocatedAmount ?? a.amount ?? 0)),
    0
  );
  const unallocatedBalance = Math.max(0, totalReceived - currentTotalAllocated);
  const selInvoice = outstandingInvoices.find((i) => i._id === selectedInvoiceId);

  const handleOpenAdd = async () => {
    try {
      setIsAdding(true);
      setExchangeRateInput('');
      const partyId = payment.party?._id || payment.party;
      const res = await getOutstandingByParty(partyId);
      // Show invoices in EVERY currency (not just the payment currency) so a
      // foreign-currency payment can be matched to invoices too.
      const list = flattenOutstandingInvoices(res.data.data || res.data || [], '');
      setOutstandingInvoices(list);
      if (list.length > 0) {
        setSelectedInvoiceId(list[0]._id);
        const maxCan = Math.min(unallocatedBalance, list[0].outstanding);
        setNewAllocAmount(maxCan.toString());
      }
    } catch {
      toast.error('Failed to load outstanding invoices');
      setIsAdding(false);
    }
  };

  const handleCreateNewAllocation = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newAllocAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amt > unallocatedBalance) {
      toast.error(`Amount exceeds unallocated balance (${formatCurrency(unallocatedBalance, currency)})`);
      return;
    }

    const selInvoice = outstandingInvoices.find((i) => i._id === selectedInvoiceId);
    const isCross = selInvoice && selInvoice.currency && selInvoice.currency !== currency;

    // Cross-currency (payment currency differs from invoice currency) needs a rate.
    if (isCross) {
      const rate = parseFloat(exchangeRateInput) || 0;
      if (rate <= 0) {
        toast.error(`Enter the exchange rate (1 ${currency} = ? ${selInvoice.currency}) to allocate this payment.`);
        return;
      }
      const settled = amt * rate;
      if (settled > parseFloat(selInvoice.outstanding) + 0.01) {
        toast.error(`Converted amount (${formatCurrency(settled, selInvoice.currency)}) exceeds the invoice outstanding (${formatCurrency(selInvoice.outstanding, selInvoice.currency)}).`);
        return;
      }
    }

    try {
      setSavingAlloc(true);
      if (isCross) {
        const rate = parseFloat(exchangeRateInput) || 0;
        await createAllocation({
          payment: payment._id,
          sale: selectedInvoiceId,
          allocatedAmount: amt,
          isCrossCurrency: true,
          exchangeRateUsed: rate,
          settlementAmountInSaleCurrency: Math.round((amt * rate + Number.EPSILON) * 100) / 100,
          notes: `1 ${currency} = ${rate} ${selInvoice.currency}`,
        });
      } else {
        await createAllocation({
          payment: payment._id,
          sale: selectedInvoiceId,
          allocatedAmount: amt,
        });
      }
      toast.success('Allocation added successfully');
      setIsAdding(false);
      setNewAllocAmount('');
      setExchangeRateInput('');
      fetchAllocations();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add allocation');
    } finally {
      setSavingAlloc(false);
    }
  };

  const handleReverse = async () => {
    if (!allocationToReverse) return;
    try {
      setReversing(true);
      await reverseAllocation(allocationToReverse._id, { reason: 'Reversed by user' });
      toast.success('Allocation reversed successfully');
      setAllocationToReverse(null);
      fetchAllocations();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse allocation');
    } finally {
      setReversing(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Payment Invoice Allocations" size="lg">
        <div className="space-y-5 text-sm">
          {/* Header Summary */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-bold text-slate-800">{payment?.party?.name || 'Customer'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Date</p>
              <p className="font-semibold text-slate-700">{formatDate(payment?.paymentDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Received</p>
              <p className="font-bold text-slate-800">{formatCurrency(totalReceived, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Unallocated Advance</p>
              <p className="font-bold text-purple-700">{formatCurrency(unallocatedBalance, currency)}</p>
            </div>
          </div>

          {/* Allocation Action */}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-gold-500" />
              Allocated Invoices
            </h3>
            {unallocatedBalance > 0 && !isAdding && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn-primary text-xs py-1.5 flex items-center gap-1"
              >
                <Plus size={14} /> Allocate Advance ({formatCurrency(unallocatedBalance, currency)})
              </button>
            )}
          </div>

          {/* Add Allocation Form */}
          {isAdding && (
            <form onSubmit={handleCreateNewAllocation} className="p-4 rounded-xl bg-gold-50/50 border border-gold-200 space-y-3">
              <h4 className="text-xs font-bold text-gold-900 uppercase tracking-wide">
                Allocate Advance to Pending Invoice
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Target Invoice</label>
                  <select
                    className="input text-xs"
                    value={selectedInvoiceId}
                    onChange={(e) => {
                      setSelectedInvoiceId(e.target.value);
                      setExchangeRateInput('');
                      const inv = outstandingInvoices.find((i) => i._id === e.target.value);
                      if (inv) {
                        const maxCan = Math.min(unallocatedBalance, parseFloat(inv.outstanding) || 0);
                        setNewAllocAmount(maxCan.toString());
                      }
                    }}
                  >
                    {outstandingInvoices.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.invoiceNumber} — {formatCurrency(inv.outstanding, inv.currency)} {inv.currency} pending ({inv.productName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs">Amount to Allocate ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    max={unallocatedBalance}
                    className="input text-xs font-semibold"
                    value={newAllocAmount}
                    onChange={(e) => setNewAllocAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              {selInvoice && selInvoice.currency && selInvoice.currency !== currency && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    Cross-currency: this invoice is in <b>{selInvoice.currency}</b> but the payment is in <b>{currency}</b>.
                    Enter how many {selInvoice.currency} equals 1 {currency}.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="label text-xs mb-0">1 {currency} =</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="e.g. 1.12"
                      className="input font-semibold w-32"
                      value={exchangeRateInput}
                      onChange={(e) => setExchangeRateInput(e.target.value)}
                    />
                    <span className="text-xs text-gray-600">{selInvoice.currency}</span>
                  </div>
                  {parseFloat(exchangeRateInput) > 0 && parseFloat(newAllocAmount) > 0 && (
                    <p className="text-xs text-amber-800">
                      This reduces the {selInvoice.currency} invoice by{' '}
                      <span className="font-bold">{formatCurrency(parseFloat(newAllocAmount) * parseFloat(exchangeRateInput), selInvoice.currency)}</span>.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="btn-secondary text-xs py-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAlloc}
                  className="btn-primary text-xs py-1 flex items-center gap-1.5"
                >
                  {savingAlloc && <LoadingSpinner size="sm" />}
                  Confirm Allocation
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white rounded-lg border border-gray-100 overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-100 uppercase font-semibold text-gray-500">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Sale Date</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Allocated Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      <LoadingSpinner size="sm" className="mx-auto mb-1" />
                      Loading allocations...
                    </td>
                  </tr>
                ) : allocations.length > 0 ? (
                  allocations.map((alloc) => {
                    const sale = alloc.sale || {};
                    const isRev = alloc.status === 'reversed';
                    return (
                      <tr key={alloc._id} className={isRev ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 font-mono">
                          {sale.invoiceNumber || (typeof alloc.sale === 'string' ? alloc.sale : 'N/A')}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">
                          {formatDate(sale.saleDate || alloc.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {sale.productName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {formatCurrency(alloc.allocatedAmount ?? alloc.amount, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge status={alloc.status || 'settled'} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isRev && (
                            <button
                              type="button"
                              onClick={() => setAllocationToReverse(alloc)}
                              className="text-red-500 hover:text-red-700 font-medium p-1 hover:bg-red-50 rounded transition-colors"
                              title="Reverse this allocation"
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      No invoices currently matched. Entire payment sits as unallocated credit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary text-xs">
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Reverse Allocation Confirm */}
      <ConfirmDialog
        isOpen={!!allocationToReverse}
        onClose={() => setAllocationToReverse(null)}
        onConfirm={handleReverse}
        title="Reverse Invoice Allocation?"
        message="This will un-link this payment from the invoice, restoring the invoice's outstanding balance and returning the amount to unallocated customer credit."
        confirmText="Reverse Allocation"
        confirmClassName="btn-danger"
        loading={reversing}
      />
    </>
  );
}
