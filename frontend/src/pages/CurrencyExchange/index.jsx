import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Filter, 
  Coins, 
  Edit, 
  RotateCcw, 
  TrendingUp, 
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
  PencilLine,
  X,
  Check,
  Settings2
} from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import StatusBadge from '../../components/UI/StatusBadge';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import ExchangeForm from './ExchangeForm';
import {
  getExchanges,
  reverseExchange,
  deleteExchange,
  getCurrencyBalances,
  getExchangeINRPayments,
  addExchangeINRPayment,
  deleteExchangeINRPayment,
  getWalletAdjustments,
  createWalletAdjustment,
  updateWalletAdjustment,
  deleteWalletAdjustment,
} from '../../api/exchanges';
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

  // Delete exchange
  const [exchangeToDelete, setExchangeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // INR installment payments
  const [expandedExchange, setExpandedExchange] = useState(null);
  const [inrPayments, setInrPayments] = useState({});
  const [showAddPayment, setShowAddPayment] = useState(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentNote, setNewPaymentNote] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);

  // ── Wallet Edit state ──────────────────────────────────────────────
  const [showWalletManager, setShowWalletManager] = useState(false);
  const [walletAdjustments, setWalletAdjustments] = useState([]);
  const [walletAdjLoading, setWalletAdjLoading] = useState(false);
  // form for adding new adjustment
  const [adjCurrency, setAdjCurrency] = useState('USD');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjSaving, setAdjSaving] = useState(false);
  // inline edit
  const [editingAdj, setEditingAdj] = useState(null); // { id, amount, reason, adjustmentDate }
  const [adjToDelete, setAdjToDelete] = useState(null);
  const [adjDeleting, setAdjDeleting] = useState(false);
  // ──────────────────────────────────────────────────────────────────

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

  // Load wallet adjustments for the manager panel
  const fetchWalletAdjustments = async () => {
    try {
      setWalletAdjLoading(true);
      const res = await getWalletAdjustments();
      setWalletAdjustments(res.data?.data?.adjustments || res.data?.adjustments || []);
    } catch {
      toast.error('Failed to load wallet adjustments');
    } finally {
      setWalletAdjLoading(false);
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

  useEffect(() => {
    if (showWalletManager) fetchWalletAdjustments();
  }, [showWalletManager]);

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

  const handleDeleteExchange = async () => {
    if (!exchangeToDelete) return;
    try {
      setDeleting(true);
      await deleteExchange(exchangeToDelete._id);
      toast.success('Exchange deleted successfully');
      setExchangeToDelete(null);
      fetchExchanges();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete exchange');
    } finally {
      setDeleting(false);
    }
  };

  const toggleINRPayments = async (ex) => {
    if (expandedExchange === ex._id) {
      setExpandedExchange(null);
      return;
    }
    setExpandedExchange(ex._id);
    if (!inrPayments[ex._id]) {
      try {
        const res = await getExchangeINRPayments(ex._id);
        setInrPayments(prev => ({ ...prev, [ex._id]: res.data?.data || [] }));
      } catch {
        setInrPayments(prev => ({ ...prev, [ex._id]: [] }));
      }
    }
  };

  const handleAddINRPayment = async (exchangeId) => {
    if (!newPaymentAmount || parseFloat(newPaymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      setAddingPayment(true);
      const res = await addExchangeINRPayment(exchangeId, {
        amountINR: parseFloat(newPaymentAmount),
        paymentDate: newPaymentDate,
        notes: newPaymentNote,
      });
      toast.success('INR payment recorded');
      setInrPayments(prev => ({ ...prev, [exchangeId]: [...(prev[exchangeId] || []), res.data?.data?.payment] }));
      setShowAddPayment(null);
      setNewPaymentAmount('');
      setNewPaymentNote('');
      fetchExchanges();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add payment');
    } finally {
      setAddingPayment(false);
    }
  };

  const handleDeleteINRPayment = async (exchangeId, paymentId) => {
    try {
      await deleteExchangeINRPayment(exchangeId, paymentId);
      toast.success('Payment deleted');
      setInrPayments(prev => ({ ...prev, [exchangeId]: (prev[exchangeId] || []).filter(p => p._id !== paymentId) }));
      fetchExchanges();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete payment');
    }
  };

  // ── Wallet Adjustment handlers ─────────────────────────────────────
  const handleAddAdjustment = async () => {
    if (!adjAmount || parseFloat(adjAmount) === 0) {
      toast.error('Enter a non-zero amount (positive to add, negative to subtract)');
      return;
    }
    try {
      setAdjSaving(true);
      await createWalletAdjustment({
        currency: adjCurrency,
        amount: parseFloat(adjAmount),
        reason: adjReason,
        adjustmentDate: adjDate,
      });
      toast.success('Wallet adjusted successfully');
      setAdjAmount('');
      setAdjReason('');
      fetchWalletAdjustments();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust wallet');
    } finally {
      setAdjSaving(false);
    }
  };

  const handleUpdateAdjustment = async () => {
    if (!editingAdj) return;
    try {
      setAdjSaving(true);
      await updateWalletAdjustment(editingAdj._id, {
        amount: parseFloat(editingAdj.amount),
        reason: editingAdj.reason,
        adjustmentDate: editingAdj.adjustmentDate,
      });
      toast.success('Adjustment updated');
      setEditingAdj(null);
      fetchWalletAdjustments();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update adjustment');
    } finally {
      setAdjSaving(false);
    }
  };

  const handleDeleteAdjustment = async () => {
    if (!adjToDelete) return;
    try {
      setAdjDeleting(true);
      await deleteWalletAdjustment(adjToDelete._id);
      toast.success('Adjustment deleted');
      setAdjToDelete(null);
      fetchWalletAdjustments();
      fetchBalances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete adjustment');
    } finally {
      setAdjDeleting(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────

  return (
    <div className="pb-12">
      <TopBar title="Currency Exchange" subtitle="Manage foreign currency holdings, conversions & INR settlements">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWalletManager(!showWalletManager)}
            className={`btn-secondary flex items-center gap-1.5 text-sm py-2 ${showWalletManager ? 'ring-2 ring-gold-400' : ''}`}
            title="Edit / adjust wallet balances"
          >
            <Settings2 size={15} /> Edit Wallet
          </button>
          <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-1.5 text-sm py-2">
            <Plus size={16} /> Record Exchange
          </button>
        </div>
      </TopBar>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Wallet Cards – INR excluded */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Coins size={18} className="text-gold-500" />
            <h2 className="text-base font-bold text-slate-800">Currency Wallet</h2>
            <span className="text-[11px] text-gray-400">All payments received from any party are added here automatically</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {holdings.filter(h => h.currency !== 'INR').length > 0 ? (
              holdings.filter(h => h.currency !== 'INR').map((h) => {
                const bal = parseFloat(h.currentHolding ?? h.currentBalance ?? h.balance ?? 0);
                const isPositive = bal > 0;
                return (
                  <div key={h.currency} className="card p-4 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-1 rounded bg-navy-50 text-navy-700 font-bold text-xs uppercase tracking-wide">
                        {h.currency}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isPositive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isPositive ? 'Available' : 'Low / Zero'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">Available Balance</p>
                    <p className="text-2xl font-bold text-slate-800 tracking-tight">
                      {formatCurrency(bal, h.currency)}
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                      <div>
                        <span className="block text-gray-400">Total Received:</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(h.totalReceived || 0, h.currency)}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Exchanged to INR:</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(h.netINRFromExchanges || h.totalExchanged || 0, h.currency)}</span>
                      </div>
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

        {/* ── Wallet Manager Panel ──────────────────────────────────── */}
        {showWalletManager && (
          <div className="card border-2 border-gold-200 bg-gold-50/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-gold-600" />
                <h3 className="text-sm font-bold text-slate-800">Wallet Balance Editor</h3>
                <span className="text-[11px] text-gray-400">Add manual corrections / opening balances to any currency wallet</span>
              </div>
              <button onClick={() => setShowWalletManager(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Add new adjustment form */}
            <div className="bg-white rounded-lg border border-gold-100 p-4 mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Add Wallet Adjustment</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Currency</p>
                  <select value={adjCurrency} onChange={e => setAdjCurrency(e.target.value)} className="input text-xs py-1 w-28">
                    {CURRENCIES.filter(c => c !== 'INR').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Amount (+ add, - subtract)</p>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 500 or -200"
                    value={adjAmount}
                    onChange={e => setAdjAmount(e.target.value)}
                    className="input text-xs py-1 w-36 font-mono"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Date</p>
                  <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} className="input text-xs py-1 w-36" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <p className="text-[10px] text-gray-400 mb-1">Reason (optional)</p>
                  <input
                    type="text"
                    placeholder="e.g. Opening stock, correction..."
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                    className="input text-xs py-1 w-full"
                  />
                </div>
                <button
                  onClick={handleAddAdjustment}
                  disabled={adjSaving}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1"
                >
                  <Plus size={13} /> {adjSaving ? 'Saving...' : 'Add Adjustment'}
                </button>
              </div>
            </div>

            {/* List of existing adjustments */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Existing Adjustments</p>
              {walletAdjLoading ? (
                <div className="text-center py-4"><LoadingSpinner size="sm" className="mx-auto" /></div>
              ) : walletAdjustments.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-3 text-center">No wallet adjustments recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Currency</th>
                        <th className="text-right py-2 px-2">Amount</th>
                        <th className="text-left py-2 px-2">Reason</th>
                        <th className="py-2 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {walletAdjustments.map(adj => (
                        <tr key={adj._id} className="hover:bg-white/80">
                          {editingAdj && editingAdj._id === adj._id ? (
                            // Inline edit row
                            <>
                              <td className="py-1.5 px-2">
                                <input
                                  type="date"
                                  value={editingAdj.adjustmentDate ? editingAdj.adjustmentDate.split('T')[0] : ''}
                                  onChange={e => setEditingAdj(prev => ({ ...prev, adjustmentDate: e.target.value }))}
                                  className="input text-xs py-0.5 w-32"
                                />
                              </td>
                              <td className="py-1.5 px-2 font-bold text-slate-700">{adj.currency}</td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingAdj.amount}
                                  onChange={e => setEditingAdj(prev => ({ ...prev, amount: e.target.value }))}
                                  className="input text-xs py-0.5 w-28 font-mono text-right"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={editingAdj.reason}
                                  onChange={e => setEditingAdj(prev => ({ ...prev, reason: e.target.value }))}
                                  className="input text-xs py-0.5 w-full"
                                  placeholder="Reason..."
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={handleUpdateAdjustment}
                                    disabled={adjSaving}
                                    className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
                                    title="Save"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={() => setEditingAdj(null)}
                                    className="p-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100"
                                    title="Cancel"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            // Display row
                            <>
                              <td className="py-1.5 px-2 text-gray-500">
                                {adj.adjustmentDate ? new Date(adj.adjustmentDate).toLocaleDateString('en-IN') : '-'}
                              </td>
                              <td className="py-1.5 px-2">
                                <span className="font-bold text-slate-700 px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{adj.currency}</span>
                              </td>
                              <td className={`py-1.5 px-2 text-right font-mono font-bold ${parseFloat(adj.amount) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {parseFloat(adj.amount) >= 0 ? '+' : ''}{parseFloat(adj.amount).toFixed(2)}
                              </td>
                              <td className="py-1.5 px-2 text-gray-500 max-w-xs truncate">{adj.reason || '-'}</td>
                              <td className="py-1.5 px-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => setEditingAdj({
                                      _id: adj._id,
                                      amount: adj.amount,
                                      reason: adj.reason || '',
                                      adjustmentDate: adj.adjustmentDate,
                                    })}
                                    className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                                    title="Edit"
                                  >
                                    <PencilLine size={12} />
                                  </button>
                                  <button
                                    onClick={() => setAdjToDelete(adj)}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── End Wallet Manager ─────────────────────────────────────── */}

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
                      <React.Fragment key={ex._id}>
                        <tr className={`hover:bg-gray-50/80 transition-colors ${isRev ? 'opacity-50 bg-gray-50' : ''}`}>
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
                            <button
                              onClick={() => toggleINRPayments(ex)}
                              className="text-[10px] text-gold-600 hover:underline mt-0.5 flex items-center gap-0.5"
                            >
                              {expandedExchange === ex._id ? <><ChevronUp size={10}/>Hide</> : <><ChevronDown size={10}/>Installments</>}
                            </button>
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
                                <button
                                  type="button"
                                  onClick={() => setExchangeToDelete(ex)}
                                  title="Delete Exchange"
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <StatusBadge status="reversed" />
                            )}
                          </td>
                        </tr>

                        {expandedExchange === ex._id && (
                          <tr key={`inr-${ex._id}`}>
                            <td colSpan={12} className="bg-amber-50/60 border-b border-amber-100 px-6 py-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold text-amber-800">INR Payment Installments</p>
                                  <button
                                    onClick={() => setShowAddPayment(showAddPayment === ex._id ? null : ex._id)}
                                    className="text-xs text-gold-600 hover:underline font-semibold flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Add Payment
                                  </button>
                                </div>
                                {showAddPayment === ex._id && (
                                  <div className="flex flex-wrap items-end gap-2 p-2 bg-white rounded-lg border border-amber-200">
                                    <div>
                                      <p className="text-[10px] text-gray-400 mb-0.5">Date</p>
                                      <input type="date" value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="input text-xs py-1 w-36" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-400 mb-0.5">Amount (₹)</p>
                                      <input type="number" step="0.01" placeholder="50000" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} className="input text-xs py-1 w-32 font-bold" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-400 mb-0.5">Note</p>
                                      <input type="text" placeholder="Optional note" value={newPaymentNote} onChange={e => setNewPaymentNote(e.target.value)} className="input text-xs py-1 w-36" />
                                    </div>
                                    <button onClick={() => handleAddINRPayment(ex._id)} disabled={addingPayment} className="btn-primary text-xs py-1 px-3">
                                      {addingPayment ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={() => setShowAddPayment(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                                  </div>
                                )}
                                {(inrPayments[ex._id] || []).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No installment payments recorded yet.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead><tr className="text-gray-400"><th className="text-left py-1">Date</th><th className="text-right py-1">Amount (₹)</th><th className="text-left py-1">Note</th><th className="py-1"></th></tr></thead>
                                    <tbody>
                                      {(inrPayments[ex._id] || []).map(p => (
                                        <tr key={p._id} className="border-t border-amber-100">
                                          <td className="py-1 text-gray-600">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '-'}</td>
                                          <td className="py-1 text-right font-bold text-green-700">₹{parseFloat(p.amountINR).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td className="py-1 text-gray-500">{p.notes || '-'}</td>
                                          <td className="py-1 text-right">
                                            <button onClick={() => handleDeleteINRPayment(ex._id, p._id)} className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 size={12} /></button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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

      {/* Delete Exchange Dialog */}
      <ConfirmDialog
        isOpen={!!exchangeToDelete}
        onClose={() => setExchangeToDelete(null)}
        onConfirm={handleDeleteExchange}
        title="Delete Exchange Record?"
        message={`Are you sure you want to permanently delete this exchange record? This cannot be undone.`}
        confirmText="Delete Permanently"
        confirmClassName="btn-danger"
        loading={deleting}
      />

      {/* Delete Wallet Adjustment Dialog */}
      <ConfirmDialog
        isOpen={!!adjToDelete}
        onClose={() => setAdjToDelete(null)}
        onConfirm={handleDeleteAdjustment}
        title="Delete Wallet Adjustment?"
        message={`Are you sure you want to delete this wallet adjustment of ${adjToDelete?.currency} ${adjToDelete?.amount > 0 ? '+' : ''}${adjToDelete?.amount}? This will affect your wallet balance.`}
        confirmText="Delete Adjustment"
        confirmClassName="btn-danger"
        loading={adjDeleting}
      />
    </div>
  );
}
