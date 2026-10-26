import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  Coins, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Wallet,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import SummaryCard from '../../components/UI/SummaryCard';
import StatusBadge from '../../components/UI/StatusBadge';
import EmptyState from '../../components/UI/EmptyState';
import LoadingSpinner, { PageLoader } from '../../components/UI/LoadingSpinner';
import { getDashboardSummary, getPartyTable, getCurrencyPositions } from '../../api/dashboard';
import { formatCurrency, formatDate, COUNTRIES, CURRENCIES, getCurrencySymbol } from '../../utils/formatters';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [partyTable, setPartyTable] = useState([]);
  const [currencyPositions, setCurrencyPositions] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search) params.search = search;
      if (countryFilter) params.country = countryFilter;
      if (currencyFilter) params.currency = currencyFilter;

      const [summaryRes, partyRes, fxRes] = await Promise.all([
        getDashboardSummary(params),
        getPartyTable(params),
        getCurrencyPositions(),
      ]);

      setSummary(summaryRes.data.data || summaryRes.data || {});

      const partyData = partyRes.data.data || partyRes.data || {};
      setPartyTable(Array.isArray(partyData) ? partyData : partyData.rows || []);

      const fxData = fxRes.data.data || fxRes.data || {};
      setCurrencyPositions(Array.isArray(fxData) ? fxData : fxData.holdings || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate, countryFilter, currencyFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDashboardData();
  };

  if (loading && !summary) {
    return <PageLoader />;
  }

  // Format outstanding per currency (object -> array, e.g. {USD: 1500} -> [{currency:'USD', amount:1500}])
  // Dashboard is USD-first, so INR receivables are omitted here.
  const rawOutstanding = summary?.outstandingByCurrency || summary?.outstanding || {};
  const outstandingList = (Array.isArray(rawOutstanding)
    ? rawOutstanding
    : Object.entries(rawOutstanding).map(([currency, amount]) => ({ currency, amount })))
    .filter((item) => (item.currency || 'INR') !== 'INR');

  // Per-currency profit breakdown for dual-currency display (INR + USD / other foreign)
  const profitByCurrency = summary?.profitByCurrency || {};
  const foreignProfitEntries = Object.entries(profitByCurrency).filter(
    ([cur, p]) => cur !== 'INR' && parseFloat(p?.profitForeign || 0) !== 0
  );
  const foreignProfitText = foreignProfitEntries.map(([cur, p]) =>
    `${formatCurrency(p.profitForeign, cur)} ${cur}`
  ).join(' · ');

  // Per-currency received breakdown so foreign payments show on the dashboard
  const receivedByCurrency = summary?.paymentsByCurrency || summary?.receivedByCurrency || {};
  const foreignReceivedEntries = Object.entries(receivedByCurrency).filter(
    ([cur, p]) => cur !== 'INR' && parseFloat(p?.totalReceived || 0) !== 0
  );
  const foreignReceivedText = foreignReceivedEntries.map(([cur, p]) =>
    `${formatCurrency(p.totalReceived, cur)} ${cur}`
  ).join(' · ');

  return (
    <div className="pb-12">
      <TopBar title="Dashboard" subtitle="Overview of Sales, Cash Flows & Multi-Currency Positions">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input py-1 text-xs w-36 bg-gray-50 border-gray-200"
            title="Start Date"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input py-1 text-xs w-36 bg-gray-50 border-gray-200"
            title="End Date"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-gold-600 hover:underline px-1"
            >
              Reset
            </button>
          )}
        </div>
      </TopBar>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <SummaryCard
            title="Total Sales (USD)"
            value={formatCurrency(summary?.totalSalesUSD || summary?.totalSales || 0, 'USD')}
            subValue={`${summary?.totalSalesCount || 0} invoices recorded`}
            icon={TrendingUp}
            color="gold"
          />
          <SummaryCard
            title="Est. Net Profit (USD)"
            value={formatCurrency(summary?.totalProfitUSD || summary?.totalProfit || 0, 'USD')}
            subValue={
              foreignProfitText ? (
                <span className="block space-y-0.5">
                  <span>Estimated margin on sales</span>
                  <span className="block font-bold text-green-600">{foreignProfitText}</span>
                </span>
              ) : (
                'Estimated margin on sales'
              )
            }
            icon={DollarSign}
            color="green"
          />
          <SummaryCard
            title="Total Received (USD)"
            value={formatCurrency(summary?.totalReceivedUSD || summary?.totalReceived || 0, 'USD')}
            subValue={
              foreignReceivedText ? (
                <span className="block space-y-0.5">
                  <span>{summary?.paymentsCount || 0} payments credited</span>
                  <span className="block font-bold text-blue-600">{foreignReceivedText}</span>
                </span>
              ) : (
                `${summary?.paymentsCount || 0} payments credited`
              )
            }
            icon={CheckCircle}
            color="blue"
          />
          <div className="card">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                <Clock size={22} />
              </div>
              <span className="text-xs text-gray-400 font-medium">By Currency</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">Outstanding Receivables</p>
            <div className="space-y-1 mt-2">
              {Array.isArray(outstandingList) && outstandingList.length > 0 ? (
                outstandingList.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-700">{item.currency || 'INR'}:</span>
                    <span className="font-bold text-red-600">{formatCurrency(item.amount || item.balance, item.currency)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xl font-bold text-slate-800 leading-tight">
                  {formatCurrency(summary?.totalOutstandingUSD || 0, 'USD')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Currency Holdings Panel */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="text-gold-500" size={20} />
              <h2 className="text-base font-bold text-slate-800">Currency Wallet (Foreign Holdings)</h2>
            </div>
            <Link to="/currency-exchange" className="text-xs font-semibold text-gold-600 hover:text-gold-700 flex items-center gap-1">
              Exchange Currency <ArrowUpRight size={14} />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {currencyPositions && currencyPositions.length > 0 ? (
              currencyPositions.map((pos) => {
                const bal = parseFloat(pos.currentHolding ?? pos.currentBalance ?? pos.balance ?? 0);
                const isPositive = bal > 0;
                return (
                  <div key={pos.currency} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-600 px-2 py-0.5 bg-white rounded shadow-xs border border-gray-100">
                        {pos.currency}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{getCurrencySymbol(pos.currency)}</span>
                    </div>
                    <p className={`text-base font-bold ${isPositive ? 'text-slate-800' : 'text-gray-400'}`}>
                      {formatCurrency(bal, pos.currency)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Recv: {formatCurrency(pos.totalReceived || 0, pos.currency)}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-4 text-center text-sm text-gray-400">
                No foreign currency balances recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Party Accounting Table */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-gold-500" />
                Party Accounting Overview
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Summary of ledger balances per client and country</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search party..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-9 pr-3 py-1.5 text-xs w-48"
                />
              </form>

              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="input py-1.5 text-xs w-36"
              >
                <option value="">All Countries</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="input py-1.5 text-xs w-32"
              >
                <option value="">All Currencies</option>
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4 text-right">Total Sales</th>
                  <th className="py-3 px-4 text-right">Received</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Est. Profit (USD)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partyTable && partyTable.length > 0 ? (
                  partyTable.map((p) => {
                    const partyId = p._id || p.partyId || p.party?._id;
                    const name = p.name || p.party?.name || 'Unknown';
                    const country = p.country || p.party?.country || '-';
                    const cur = p.preferredCurrency || p.currency || 'USD';

                    // Show sales / received / outstanding in the party's primary
                    // currency (uses the per-currency balances from the API).
                    const balances = p.balances || [];
                    const primary = balances.find((b) => b.currency !== 'INR' && parseFloat(b.totalSales || 0) > 0)
                      || balances.find((b) => b.currency === 'INR')
                      || {};
                    const dispCur = primary.currency || cur;
                    const dispSales = primary.totalSales != null ? primary.totalSales : p.totalSalesINR;
                    const dispReceived = primary.totalAllocated != null ? primary.totalAllocated : p.totalReceivedINR;
                    const dispOutstanding = primary.outstanding != null ? primary.outstanding : p.outstandingINR;

                    return (
                      <tr key={partyId || name} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <Link to={`/parties/${partyId}`} className="hover:text-gold-600 transition-colors">
                            {name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{country}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatCurrency(dispSales, dispCur)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-green-600">
                          {formatCurrency(dispReceived, dispCur)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-red-600">
                          {formatCurrency(dispOutstanding, dispCur)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-medium text-slate-600">
                            {formatCurrency(p.totalProfitUSD ?? (p.profitByCurrency?.USD?.profitForeign ?? 0), 'USD')}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={p.status || (p.outstanding > 0 ? 'partial' : 'settled')} />
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {formatDate(p.lastTransactionDate || p.updatedAt)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            to={`/parties/${partyId}`}
                            className="text-xs text-gold-600 hover:text-gold-700 font-semibold px-2.5 py-1 bg-gold-50 hover:bg-gold-100 rounded-md transition-colors"
                          >
                            Ledger
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon={Users}
                        title="No parties found"
                        description="Start by adding clients and recording transactions."
                        action={
                          <Link to="/parties" className="btn-primary text-xs py-1.5">
                            Go to Parties
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
