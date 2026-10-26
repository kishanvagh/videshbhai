import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ShoppingBag, 
  Edit, 
  Trash2, 
  Eye, 
  Ban,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import StatusBadge from '../../components/UI/StatusBadge';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import Modal from '../../components/UI/Modal';
import LoadingSpinner, { PageLoader } from '../../components/UI/LoadingSpinner';
import SaleForm from './SaleForm';
import { getSales, cancelSale } from '../../api/sales';
import { getParties } from '../../api/parties';
import { formatCurrency, formatDate, CURRENCIES } from '../../utils/formatters';

export default function SoldItems() {
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [viewSaleModal, setViewSaleModal] = useState(null);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        search,
        party: partyFilter,
        status: statusFilter,
        currency: currencyFilter,
        startDate,
        endDate,
      };
      const res = await getSales(params);
      const data = res.data.data || res.data;
      if (Array.isArray(data)) {
        setSales(data);
        setTotalPages(1);
        setTotalRecords(data.length);
      } else {
        setSales(data.sales || []);
        setTotalPages(data.totalPages || 1);
        setTotalRecords(data.total || data.totalSales || (data.sales ? data.sales.length : 0));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sales list');
    } finally {
      setLoading(false);
    }
  };

  const loadParties = async () => {
    try {
      const res = await getParties({ limit: 100 });
      setParties(res.data.data?.parties || res.data.data || res.data || []);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    fetchSales();
  }, [page, partyFilter, statusFilter, currencyFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSales();
  };

  const handleOpenAdd = () => {
    setSelectedSale(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sale) => {
    setSelectedSale(sale);
    setIsFormOpen(true);
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    try {
      setCancelling(true);
      await cancelSale(saleToCancel._id, { reason: 'Cancelled by user' });
      toast.success('Sale invoice cancelled successfully');
      setSaleToCancel(null);
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel sale invoice');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="pb-12">
      <TopBar title="Sold Items" subtitle="Manage jewelry sales invoices, pricing, and settlements">
        <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> Add Sale
        </button>
      </TopBar>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Filters Bar */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <form onSubmit={handleSearchSubmit} className="sm:col-span-2 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoice, item, party..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs"
              />
            </form>

            <div>
              <select
                value={partyFilter}
                onChange={(e) => { setPartyFilter(e.target.value); setPage(1); }}
                className="input text-xs"
              >
                <option value="">All Parties</option>
                {parties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="input text-xs"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="partial">Partial</option>
                <option value="settled">Settled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <select
                value={currencyFilter}
                onChange={(e) => { setCurrencyFilter(e.target.value); setPage(1); }}
                className="input text-xs"
              >
                <option value="">All Currencies</option>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="input text-xs py-1.5"
                title="Start Date"
              />
              <span className="text-gray-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="input text-xs py-1.5"
                title="End Date"
              />
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShoppingBag size={18} className="text-gold-500" />
              Sales Invoices
            </h2>
            <span className="text-xs text-gray-500">{totalRecords} records found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4 text-right">Sale Price (USD)</th>
                  <th className="py-3 px-4 text-right">Home Price</th>
                  <th className="py-3 px-4 text-right">Est. Profit (USD)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <LoadingSpinner size="lg" className="mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Loading invoices...</p>
                    </td>
                  </tr>
                ) : sales.length > 0 ? (
                  sales.map((sale) => {
                    const partyName = sale.party?.name || sale.partyName || 'Unknown';
                    const productName = sale.productName || sale.itemDetails?.name || 'Jewelry Item';
                    const cur = sale.foreignCurrency || sale.currency || 'USD';
                    const isCancelled = sale.status === 'cancelled';

                    return (
                      <tr key={sale._id} className={`hover:bg-gray-50/80 transition-colors ${isCancelled ? 'opacity-60 bg-gray-50/50' : ''}`}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                          {sale.invoiceNumber || `INV-${sale._id.slice(-6)}`}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                          {formatDate(sale.saleDate || sale.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {partyName}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800 text-xs">{productName}</p>
                          {sale.productDescription && (
                            <p className="text-[11px] text-gray-400 truncate max-w-xs">{sale.productDescription}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {formatCurrency(sale.saleAmountForeign ?? sale.amountForeign ?? 0, cur)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {parseFloat(sale.saleAmountINR ?? sale.amountINR ?? 0) > 0
                            ? formatCurrency(sale.saleAmountINR ?? sale.amountINR ?? 0, sale.homePriceCurrency || 'INR')
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-green-600">
                          {formatCurrency(sale.estimatedProfitForeign ?? sale.profitForeign ?? 0, cur)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewSaleModal(sale)}
                              title="View details"
                              className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-slate-800 transition-colors"
                            >
                              <Eye size={15} />
                            </button>

                            {!isCancelled && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(sale)}
                                  title="Edit invoice"
                                  className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors"
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSaleToCancel(sale)}
                                  title="Cancel invoice"
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <Ban size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={ShoppingBag}
                        title="No sales recorded yet"
                        description="Start creating invoices for jewelry sales to track receivables and profits."
                        action={
                          <button onClick={handleOpenAdd} className="btn-primary text-xs py-1.5">
                            + Record First Sale
                          </button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      {/* Sale Form Modal */}
      <SaleForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        sale={selectedSale}
        onSuccess={fetchSales}
      />

      {/* View Detail Modal */}
      <Modal
        isOpen={!!viewSaleModal}
        onClose={() => setViewSaleModal(null)}
        title={`Invoice: ${viewSaleModal?.invoiceNumber || ''}`}
        size="md"
      >
        {viewSaleModal && (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-bold text-slate-800 text-base">{viewSaleModal.party?.name || 'Unknown'}</p>
              </div>
              <StatusBadge status={viewSaleModal.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Date:</p>
                <p className="font-semibold text-slate-700">{formatDate(viewSaleModal.saleDate)}</p>
              </div>
              <div>
                <p className="text-gray-400">Quantity:</p>
                <p className="font-semibold text-slate-700">{viewSaleModal.quantity || 1} units</p>
              </div>
              <div>
                <p className="text-gray-400">Product:</p>
                <p className="font-semibold text-slate-700">{viewSaleModal.productName}</p>
              </div>
              <div>
                <p className="text-gray-400">Description:</p>
                <p className="text-slate-600">{viewSaleModal.productDescription || '-'}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Financial Representation</p>
              <div className="flex justify-between">
                <span className="text-gray-500">Sale Price (USD):</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(viewSaleModal.saleAmountForeign ?? 0, viewSaleModal.foreignCurrency || 'USD')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Home Price:</span>
                <span className="font-bold text-slate-800">
                  {parseFloat(viewSaleModal.saleAmountINR || 0) > 0
                    ? formatCurrency(viewSaleModal.saleAmountINR, viewSaleModal.homePriceCurrency || 'INR')
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-500">Estimated Profit (USD):</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(viewSaleModal.estimatedProfitForeign || 0, viewSaleModal.foreignCurrency || 'USD')}
                </span>
              </div>
            </div>

            {viewSaleModal.notes && (
              <div>
                <p className="text-xs text-gray-400">Notes:</p>
                <p className="text-xs text-slate-600 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  {viewSaleModal.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button onClick={() => setViewSaleModal(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!saleToCancel}
        onClose={() => setSaleToCancel(null)}
        onConfirm={handleCancelSale}
        title="Cancel Sale Invoice?"
        message={`Are you sure you want to cancel invoice "${saleToCancel?.invoiceNumber || ''}"? This will reverse the receivables recorded against this invoice.`}
        confirmText="Cancel Invoice"
        confirmClassName="btn-danger"
        loading={cancelling}
      />
    </div>
  );
}
