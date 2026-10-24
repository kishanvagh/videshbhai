import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  RotateCcw, 
  Layers, 
  ArrowDownLeft,
  Calendar,
  Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import StatusBadge from '../../components/UI/StatusBadge';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import PaymentForm from './PaymentForm';
import AllocationView from './AllocationView';
import { getPayments, reversePayment } from '../../api/payments';
import { getParties, getPartyBalances } from '../../api/parties';
import { getOutstandingReport } from '../../api/reports';
import { formatCurrency, formatDate, CURRENCIES, PAYMENT_METHODS } from '../../utils/formatters';

export default function Payments() {
  const [activeTab, setActiveTab] = useState('outstanding'); // 'outstanding' | 'history'
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [outstandingData, setOutstandingData] = useState([]);
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [prefillParty, setPrefillParty] = useState('');
  const [prefillCurrency, setPrefillCurrency] = useState('');
  const [selectedPaymentForAlloc, setSelectedPaymentForAlloc] = useState(null);
  const [paymentToReverse, setPaymentToReverse] = useState(null);
  const [reversing, setReversing] = useState(false);

  // Load parties list
  useEffect(() => {
    getParties({ limit: 100 })
      .then((res) => {
        const list = res.data.data?.parties || res.data.data || res.data || [];
        setParties(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  const fetchOutstandingBalances = async () => {
    try {
      setLoading(true);
      const params = {
        search,
        party: partyFilter,
        currency: currencyFilter,
        status: statusFilter,
      };
      // Fetch outstanding invoice report and reshape rows for the table
      const res = await getOutstandingReport(params);
      const data = res.data.data || res.data || [];
      const invoices = Array.isArray(data) ? data : data.invoices || [];
      const list = (Array.isArray(invoices) ? invoices : []).map((inv, idx) => {
        const sale = inv.sale || inv;
        const out = inv.outstanding || {};
        const party = sale.party || null;
        const cur = sale.foreignCurrency || 'INR';
        const invoiced = parseFloat(cur !== 'INR' && sale.saleAmountForeign
          ? sale.saleAmountForeign
          : sale.saleAmountINR || 0);
        const outstandingAmt = parseFloat(cur !== 'INR'
          ? (out.outstandingForeign || 0)
          : (out.outstandingINR || 0));
        return {
          party,
          partyId: party?._id || sale._id || idx,
          currency: cur,
          totalInvoiced: invoiced,
          totalSales: invoiced,
          totalReceived: Math.max(0, invoiced - outstandingAmt),
          outstandingAmount: outstandingAmt,
          outstanding: outstandingAmt,
          lastPaymentDate: sale.lastPaymentDate || null,
        };
      });
      setOutstandingData(list);
      setTotalPages(1);
      setTotalRecords(list.length);
    } catch {
      toast.error('Failed to load outstanding balances');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        search,
        party: partyFilter,
        currency: currencyFilter,
        method: methodFilter,
        startDate,
        endDate,
      };
      const res = await getPayments(params);
      const data = res.data.data || res.data || [];
      if (Array.isArray(data)) {
        setPayments(data);
        setTotalPages(1);
        setTotalRecords(data.length);
      } else {
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setTotalPages(data.totalPages || 1);
        setTotalRecords(data.total || data.payments?.length || 0);
      }
    } catch {
      toast.error('Failed to load payments history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'outstanding') {
      fetchOutstandingBalances();
    } else {
      fetchPaymentsHistory();
    }
  }, [activeTab, page, partyFilter, currencyFilter, statusFilter, methodFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    if (activeTab === 'outstanding') fetchOutstandingBalances();
    else fetchPaymentsHistory();
  };

  const handleOpenRecordPayment = (partyId = '', currency = 'USD') => {
    setPrefillParty(partyId);
    setPrefillCurrency(currency);
    setIsPaymentFormOpen(true);
  };

  const handleReversePayment = async () => {
    if (!paymentToReverse) return;
    try {
      setReversing(true);
      await reversePayment(paymentToReverse._id, { reason: 'Reversed by user request' });
      toast.success('Payment reversed successfully');
      setPaymentToReverse(null);
      fetchPaymentsHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse payment');
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="pb-12">
      <TopBar title="Payments Received" subtitle="Track receivables, advance settlements, and receipts">
        <button
          onClick={() => handleOpenRecordPayment()}
          className="btn-primary flex items-center gap-1.5 text-sm py-2"
        >
          <Plus size={16} /> Record Payment
        </button>
      </TopBar>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Tab Controls */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setActiveTab('outstanding'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'outstanding'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Wallet size={16} />
            Outstanding Balances
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('history'); setPage(1); }}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <CreditCard size={16} />
            Payment History
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <form onSubmit={handleSearchSubmit} className="sm:col-span-2 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'outstanding' ? 'Search party or country...' : 'Search reference, party...'}
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

            {activeTab === 'outstanding' ? (
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="input text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Pending / Active</option>
                  <option value="partial">Partial</option>
                  <option value="settled">Settled</option>
                </select>
              </div>
            ) : (
              <div>
                <select
                  value={methodFilter}
                  onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
                  className="input text-xs"
                >
                  <option value="">All Methods</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="input text-xs py-1.5"
                  title="From Date"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="input text-xs py-1.5"
                  title="To Date"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Outstanding Balances */}
        {activeTab === 'outstanding' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">Outstanding Balances by Party & Currency</h2>
              <span className="text-xs text-gray-500">{outstandingData.length} entries</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4 text-right">Total Invoiced</th>
                    <th className="py-3 px-4 text-right">Total Received</th>
                    <th className="py-3 px-4 text-right">Outstanding Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Last Payment</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <LoadingSpinner size="lg" className="mx-auto mb-2" />
                        <p className="text-xs text-gray-400">Loading balances...</p>
                      </td>
                    </tr>
                  ) : outstandingData.length > 0 ? (
                    outstandingData.map((row, idx) => {
                      const partyId = row.party?._id || row.partyId || row._id;
                      const partyName = row.party?.name || row.partyName || row.name || 'Unknown';
                      const cur = row.currency || 'USD';
                      const outstanding = parseFloat(row.outstandingAmount ?? row.outstanding ?? 0);
                      const isSettled = outstanding <= 0;

                      return (
                        <tr key={`${partyId}-${cur}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {partyName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-slate-700 font-bold text-xs">
                              {cur}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatCurrency(row.totalSales ?? row.totalInvoiced ?? 0, cur)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-green-600">
                            {formatCurrency(row.totalReceived ?? 0, cur)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-red-600">
                            {formatCurrency(outstanding, cur)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={isSettled ? 'settled' : 'partial'} />
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {formatDate(row.lastPaymentDate || row.lastTransactionDate)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenRecordPayment(partyId, cur)}
                              className="text-xs font-semibold px-3 py-1.5 bg-gold-500 hover:bg-gold-600 text-white rounded-lg transition-colors"
                            >
                              Record Payment
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState
                          icon={Wallet}
                          title="No outstanding balances"
                          description="All customer balances are currently clear or no transactions are present."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Payment History */}
        {activeTab === 'history' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">Payment Transactions</h2>
              <span className="text-xs text-gray-500">{totalRecords} records found</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4 text-right">Amount Received</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-center">Allocation Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <LoadingSpinner size="lg" className="mx-auto mb-2" />
                        <p className="text-xs text-gray-400">Loading payment history...</p>
                      </td>
                    </tr>
                  ) : payments.length > 0 ? (
                    payments.map((p) => {
                      const partyName = p.party?.name || p.partyName || 'Customer';
                      const cur = p.currency || 'USD';
                      const amount = parseFloat(p.amountReceived ?? p.amount ?? 0);
                      const isRev = p.status === 'reversed';
                      const unalloc = parseFloat(p.unallocatedAmount ?? 0);

                      return (
                        <tr key={p._id} className={`hover:bg-gray-50/80 transition-colors ${isRev ? 'opacity-50 bg-gray-50' : ''}`}>
                          <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                            {formatDate(p.paymentDate || p.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {partyName}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">
                            {formatCurrency(amount, cur)}
                          </td>
                          <td className="py-3 px-4 text-xs capitalize text-slate-600">
                            {p.paymentMethod?.replace('_', ' ') || 'Bank Transfer'}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-gray-500">
                            {p.bankReference || p.referenceNumber || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isRev ? (
                              <StatusBadge status="reversed" />
                            ) : unalloc > 0 ? (
                              <span className="badge-advance">Advance: {formatCurrency(unalloc, cur)}</span>
                            ) : (
                              <span className="badge-settled">Fully Allocated</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentForAlloc(p)}
                                title="View & Manage Allocations"
                                className="p-1.5 rounded hover:bg-gold-50 text-gold-600 hover:text-gold-700 transition-colors"
                              >
                                <Layers size={16} />
                              </button>

                              {!isRev && (
                                <button
                                  type="button"
                                  onClick={() => setPaymentToReverse(p)}
                                  title="Reverse Payment"
                                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <RotateCcw size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={CreditCard}
                          title="No payments found"
                          description="No payment transactions recorded for this filter selection."
                          action={
                            <button onClick={() => handleOpenRecordPayment()} className="btn-primary text-xs py-1.5">
                              + Record New Payment
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
        )}
      </div>

      {/* Record Payment Modal */}
      <PaymentForm
        isOpen={isPaymentFormOpen}
        onClose={() => setIsPaymentFormOpen(false)}
        initialPartyId={prefillParty}
        initialCurrency={prefillCurrency}
        onSuccess={() => {
          if (activeTab === 'outstanding') fetchOutstandingBalances();
          else fetchPaymentsHistory();
        }}
      />

      {/* Allocation Management Modal */}
      <AllocationView
        isOpen={!!selectedPaymentForAlloc}
        onClose={() => setSelectedPaymentForAlloc(null)}
        payment={selectedPaymentForAlloc}
        onUpdated={() => {
          fetchPaymentsHistory();
        }}
      />

      {/* Reverse Payment Confirmation */}
      <ConfirmDialog
        isOpen={!!paymentToReverse}
        onClose={() => setPaymentToReverse(null)}
        onConfirm={handleReversePayment}
        title="Reverse Payment Transaction?"
        message={`Are you sure you want to reverse this payment of ${formatCurrency(paymentToReverse?.amountReceived || paymentToReverse?.amount, paymentToReverse?.currency)}? All invoice allocations linked to this payment will be cancelled and debt restored.`}
        confirmText="Reverse Payment"
        confirmClassName="btn-danger"
        loading={reversing}
      />
    </div>
  );
}
