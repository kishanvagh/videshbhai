import { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Filter, 
  Coins, 
  Edit, 
  RotateCcw, 
  TrendingUp, 
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import StatusBadge from '../../components/UI/StatusBadge';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ExchangeForm from './ExchangeForm';
import { getExchanges, reverseExchange, getCurrencyBalances } from '../../api/exchanges';
import { getParties } from '../../api/parties';
import { formatCurrency, formatINR, formatDate, CURRENCIES } from '../../utils/formatters';

export default function CurrencyExchange() {
  const [exchanges, setExchanges] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [partyFilter, setPartyFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [exchangeToReverse, setExchangeToReverse] = useState(null);
  const [reversing, setReversing] = useState(false);

  const fetchBalances = async () => {
    try {
      const res = await getCurrencyBalances();
      const data = res.data.data || res.data || {};
      // Wallet = all currencies (foreign + INR). Falls back gracefully for old API shapes.
      const list = data.wallet || (Array.isArray(data) ? data : data.holdings || []);
      setHoldings(Array.isArray(list) ? list : []);
    } catch {
      // non-critical
    }
  };

  const fetchExchanges = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15,
        party: partyFilter,
        currency: currencyFilter,
        startDate,
        endDate,
      };
      const res = await getExchanges(params);
      const data = res.data.data || res.data || [];
      if (Array.isArray(data)) {
        setExchanges(data);
        setTotalPages(1);
        setTotalRecords(data.length);
      } else {
        setExchanges(data.exchanges || []);
        setTotalPages(data.totalPages || 1);
        setTotalRecords(data.total || data.exchanges?.length || 0);
      }
    } catch {
      toast.error('Failed to load currency exchange records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getParties({ limit: 100 })
      .then((res) => setParties(res.data.data?.parties || res.data.data || res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBalances();
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [page, partyFilter, currencyFilter, startDate, endDate]);

  const handleOpenAdd = () => {
    setSelectedExchange(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ex) => {
    setSelectedExchange(ex);
    setIsFormOpen(true);
  };

  const handleReverseExchange = async () => {
    if (!exchangeToReverse) return;
    try {
      setReversing(true);
      await reverseExchange(exchangeToReverse._id, { reason: 'Reversed by user' });
      toast.success('Exchange record reversed successfully');
      setExchangeToReverse(null);
      fetchExchanges();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse exchange');
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="pb-12">
      <TopBar title="Currency Exchange" subtitle="Manage foreign currency holdings, conversions & INR settlements">
        <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> Record Exchange
        </button>
      </TopBar>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Wallet Cards */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Coins size={18} className="text-gold-500" />
            <h2 className="text-base font-bold text-slate-800">Currency Wallet</h2>
            <span className="text-[11px] text-gray-400">All payments received from any party are added here automatically</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {holdings.length > 0 ? (
              holdings.map((h) => {
                const bal = parseFloat(h.currentHolding ?? h.currentBalance ?? h.balance ?? 0);
                const isPositive = bal > 0;
                const isINR = h.currency === 'INR';
                return (
                  <div key={h.currency} className={`card p-4 relative overflow-hidden ${isINR ? 'border-gold-300' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-1 rounded bg-navy-50 text-navy-700 font-bold text-xs uppercase tracking-wide">
                        {h.currency}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isPositive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isINR ? 'Wallet' : (isPositive ? 'Available' : 'Low / Zero')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">Available Balance</p>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">
                      {formatCurrency(bal, h.currency)}
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                      <div>
                        <span className="block text-gray-400">{isINR ? 'Received (Payments):' : 'Total Received:'}</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(h.totalReceived || 0, h.currency)}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">{isINR ? 'Received from Exch.:' : 'Exchanged to INR:'}</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(h.netINRFromExchanges || h.totalExchanged || 0, isINR ? 'INR' : h.currency)}</span>
                      </div>
                      {isINR && parseFloat(h.pendingFromExchanges || 0) > 0 && (
                        <div className="col-span-2 mt-1 pt-1.5 border-t border-amber-200 bg-amber-50 rounded-md px-2 py-1.5 flex items-center justify-between">
                          <span className="text-amber-700 font-semibold">Due from Exchange Parties</span>
                          <span className="font-bold text-amber-700">{formatINR(h.pendingFromExchanges)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full card p-6 text-center text-sm text-gray-400">
                No wallet balances yet. Record customer payments in any currency and they will appear here for currency exchange.
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <select
                value={currencyFilter}
                onChange={(e) => { setCurrencyFilter(e.target.value); setPage(1); }}
                className="input text-xs"
              >
                <option value="">All Currencies</option>
                {CURRENCIES.filter((c) => c !== 'INR').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

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

            <div className="sm:col-span-2 flex items-center gap-1">
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

            <div>
              {(currencyFilter || partyFilter || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrencyFilter('');
                    setPartyFilter('');
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="btn-secondary text-xs w-full py-2"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Exchanges History Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-gold-500" />
              Conversion History
            </h2>
            <span className="text-xs text-gray-500">{totalRecords} records found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Exchange Party</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4 text-right">Amount Exchanged</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Gross INR</th>
                  <th className="py-3 px-4 text-right">Fees</th>
                  <th className="py-3 px-4 text-right">Net INR Received</th>
                  <th className="py-3 px-4 text-right">INR Received</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center">
                      <LoadingSpinner size="lg" className="mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Loading conversion history...</p>
                    </td>
                  </tr>
                ) : exchanges.length > 0 ? (
                  exchanges.map((ex) => {
                    const partyName = ex.party?.name || ex.partyName || '-';
                    const cur = ex.foreignCurrency || 'USD';
                    const amount = parseFloat(ex.foreignAmountExchanged ?? ex.amount ?? 0);
                    const isRev = ex.status === 'reversed';

                    return (
                      <tr key={ex._id} className={`hover:bg-gray-50/80 transition-colors ${isRev ? 'opacity-50 bg-gray-50' : ''}`}>
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                          {formatDate(ex.exchangeDate || ex.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 text-xs">
                          {partyName}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 text-xs">
                          {ex.exchangePartyName || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-slate-700 font-bold text-xs">
                            {cur}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {formatCurrency(amount, cur)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-700 font-mono">
                          ₹{(ex.exchangeRate ?? ex.rate ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600 text-xs">
                          {formatINR(ex.grossINR || (amount * (ex.exchangeRate || 0)))}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-red-600">
                          {ex.bankCharges ? `-${formatINR(ex.bankCharges)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-green-600">
                          {formatINR(ex.netINRReceived ?? ex.netINR ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-green-600">
                          {formatINR(ex.inrReceivedAmount ?? 0)}
                          {parseFloat(ex.inrPendingAmount || 0) > 0 && (
                            <span className="block text-[10px] text-amber-600">Pending: {formatINR(ex.inrPendingAmount)}</span>
                          )}
                          <span className="block text-[10px] text-gray-400">{ex.paymentReceivedPercent || 0}% received</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-500">
                          {ex.referenceNumber || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isRev ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(ex)}
                                title="Edit Conversion"
                                className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setExchangeToReverse(ex)}
                                title="Reverse Conversion"
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          ) : (
                            <StatusBadge status="reversed" />
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12}>
                      <EmptyState
                        icon={ArrowLeftRight}
                        title="No currency exchanges recorded"
                        description="Convert foreign balances received from overseas sales into Indian Rupees."
                        action={
                          <button onClick={handleOpenAdd} className="btn-primary text-xs py-1.5">
                            + Convert Currency
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

      {/* Exchange Form Modal */}
      <ExchangeForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        exchange={selectedExchange}
        onSuccess={() => {
          fetchExchanges();
          fetchBalances();
        }}
      />

      {/* Reverse Exchange Dialog */}
      <ConfirmDialog
        isOpen={!!exchangeToReverse}
        onClose={() => setExchangeToReverse(null)}
        onConfirm={handleReverseExchange}
        title="Reverse Currency Exchange?"
        message={`Are you sure you want to reverse the exchange of ${formatCurrency(exchangeToReverse?.foreignAmountExchanged || exchangeToReverse?.amount, exchangeToReverse?.foreignCurrency)}? This will restore the foreign currency balance.`}
        confirmText="Reverse Exchange"
        confirmClassName="btn-danger"
        loading={reversing}
      />
    </div>
  );
}
