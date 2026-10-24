import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, TrendingUp, FileText, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import TopBar from '../../components/Layout/TopBar';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate, getCurrencySymbol } from '../../utils/formatters';
import { getSalesReport, getPaymentsReport, getOutstandingReport, getProfitReport, getExchangeReport, getMonthlyTrend, exportCSV } from '../../api/reports';
import { getParties } from '../../api/parties';

const REPORT_TYPES = [
  { key: 'sales', label: 'Sales Report', icon: TrendingUp, color: 'blue' },
  { key: 'payments', label: 'Payments Report', icon: DollarSign, color: 'green' },
  { key: 'outstanding', label: 'Outstanding Invoices', icon: Clock, color: 'amber' },
  { key: 'profit', label: 'Profit Report', icon: BarChart3, color: 'gold' },
  { key: 'exchange', label: 'Currency Exchange', icon: RefreshCw, color: 'purple' },
  { key: 'trend', label: 'Monthly Trend', icon: BarChart3, color: 'navy' },
];

export default function Reports() {
  const [reportType, setReportType] = useState('sales');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', party: '', currency: '' });
  const [generated, setGenerated] = useState(false);

  const { data: partiesData } = useQuery({ queryKey: ['parties-list'], queryFn: () => getParties({ limit: 200 }) });
  const parties = partiesData?.data?.data?.parties || partiesData?.data?.parties || [];

  const reportQuery = useQuery({
    queryKey: ['report', reportType, filters],
    queryFn: async () => {
      const params = { ...filters };
      if (reportType === 'sales') return getSalesReport(params);
      if (reportType === 'payments') return getPaymentsReport(params);
      if (reportType === 'outstanding') return getOutstandingReport(params);
      if (reportType === 'profit') return getProfitReport(params);
      if (reportType === 'exchange') return getExchangeReport(params);
      if (reportType === 'trend') return getMonthlyTrend({ months: 12 });
      return null;
    },
    enabled: generated,
  });

  const handleGenerate = () => {
    setGenerated(false);
    setTimeout(() => setGenerated(true), 50);
  };

  const handleExport = async () => {
    try {
      const response = await exportCSV({ type: reportType === 'outstanding' ? 'outstanding' : reportType, ...filters });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const rd = reportQuery.data?.data;

  return (
    <div>
      <TopBar title="Reports" subtitle="Generate and export business reports" />

      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {REPORT_TYPES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setReportType(key); setGenerated(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                  reportType === key ? 'bg-gold-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Main */}
          <div className="flex-1 space-y-4">
            {/* Filters */}
            <div className="card">
              <h3 className="font-semibold text-slate-800 mb-4">Report Filters</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="input w-40" />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="input w-40" />
                </div>
                {reportType !== 'trend' && (
                  <div>
                    <label className="label">Party</label>
                    <select value={filters.party} onChange={e => setFilters(f => ({ ...f, party: e.target.value }))} className="input w-40">
                      <option value="">All Parties</option>
                      {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={handleGenerate} className="btn-primary">Generate Report</button>
                {generated && reportType !== 'trend' && reportType !== 'profit' && (
                  <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                    <Download size={14} /> Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            {!generated ? (
              <div className="card flex flex-col items-center justify-center h-48 text-gray-400">
                <FileText size={40} className="mb-3 text-gray-300" />
                <p className="font-medium">Select filters and click Generate Report</p>
              </div>
            ) : reportQuery.isLoading ? <PageLoader /> : (
              <div className="card">
                {/* Sales Report */}
                {reportType === 'sales' && rd && (
                  <>
                    <div className="flex gap-4 mb-4 flex-wrap">
                      <div className="bg-blue-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-blue-600 font-medium">Total Sales (INR)</p>
                        <p className="text-xl font-bold text-blue-800">{formatCurrency(rd.summary?.totalINR, 'INR')}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-green-600 font-medium">Estimated Profit</p>
                        <p className="text-xl font-bold text-green-800">{formatCurrency(rd.summary?.totalProfitINR, 'INR')}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-600 font-medium">Total Invoices</p>
                        <p className="text-xl font-bold text-gray-800">{rd.summary?.count}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b">
                          <th className="text-left py-2 px-3 text-gray-500">Invoice</th>
                          <th className="text-left py-2 px-3 text-gray-500">Date</th>
                          <th className="text-left py-2 px-3 text-gray-500">Party</th>
                          <th className="text-left py-2 px-3 text-gray-500">Product</th>
                          <th className="text-right py-2 px-3 text-gray-500">INR</th>
                          <th className="text-right py-2 px-3 text-gray-500">Foreign</th>
                          <th className="text-right py-2 px-3 text-gray-500">Profit</th>
                          <th className="text-left py-2 px-3 text-gray-500">Status</th>
                        </tr></thead>
                        <tbody>
                          {rd.sales?.map(s => (
                            <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-3 font-mono text-xs">{s.invoiceNumber}</td>
                              <td className="py-2 px-3">{formatDate(s.saleDate)}</td>
                              <td className="py-2 px-3">{s.party?.name}</td>
                              <td className="py-2 px-3">{s.productName}</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(s.saleAmountINR, 'INR')}</td>
                              <td className="py-2 px-3 text-right">{s.saleAmountForeign > 0 ? formatCurrency(s.saleAmountForeign, s.foreignCurrency) : '-'}</td>
                              <td className="py-2 px-3 text-right text-green-600">{formatCurrency(s.estimatedProfitINR, 'INR')}</td>
                              <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'settled' ? 'bg-green-100 text-green-700' : s.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{s.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Payments Report */}
                {reportType === 'payments' && rd && (
                  <>
                    <div className="flex gap-4 mb-4 flex-wrap">
                      {Object.entries(rd.summary?.byCurrency || {}).map(([currency, amount]) => (
                        <div key={currency} className="bg-green-50 rounded-xl px-4 py-3">
                          <p className="text-xs text-green-600 font-medium">{currency} Received</p>
                          <p className="text-xl font-bold text-green-800">{formatCurrency(amount, currency)}</p>
                        </div>
                      ))}
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="text-left py-2 px-3 text-gray-500">Date</th><th className="text-left py-2 px-3 text-gray-500">Party</th><th className="text-right py-2 px-3 text-gray-500">Amount</th><th className="text-left py-2 px-3 text-gray-500">Currency</th><th className="text-left py-2 px-3 text-gray-500">Method</th><th className="text-left py-2 px-3 text-gray-500">Reference</th></tr></thead>
                      <tbody>
                        {rd.payments?.map(p => (
                          <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3">{formatDate(p.paymentDate)}</td>
                            <td className="py-2 px-3">{p.party?.name}</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.amountReceived, p.currency)}</td>
                            <td className="py-2 px-3">{p.currency}</td>
                            <td className="py-2 px-3 capitalize">{p.paymentMethod?.replace('_', ' ')}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{p.bankReference || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Outstanding */}
                {reportType === 'outstanding' && rd && (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left py-2 px-3 text-gray-500">Invoice</th><th className="text-left py-2 px-3 text-gray-500">Date</th><th className="text-left py-2 px-3 text-gray-500">Party</th><th className="text-left py-2 px-3 text-gray-500">Product</th><th className="text-right py-2 px-3 text-gray-500">Outstanding INR</th><th className="text-right py-2 px-3 text-gray-500">Outstanding Foreign</th><th className="text-left py-2 px-3 text-gray-500">Status</th></tr></thead>
                    <tbody>
                      {rd.invoices?.map(({ sale, outstanding }) => (
                        <tr key={sale._id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-xs">{sale.invoiceNumber}</td>
                          <td className="py-2 px-3">{formatDate(sale.saleDate)}</td>
                          <td className="py-2 px-3">{sale.party?.name}</td>
                          <td className="py-2 px-3">{sale.productName}</td>
                          <td className="py-2 px-3 text-right text-amber-600 font-semibold">{formatCurrency(outstanding.outstandingINR, 'INR')}</td>
                          <td className="py-2 px-3 text-right text-amber-600 font-semibold">{outstanding.outstandingForeign > 0.01 ? formatCurrency(outstanding.outstandingForeign, sale.foreignCurrency) : '-'}</td>
                          <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sale.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{sale.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Profit */}
                {reportType === 'profit' && rd && (
                  <>
                    <div className="bg-green-50 rounded-xl px-4 py-3 mb-4 inline-block">
                      <p className="text-xs text-green-600 font-medium">Total Estimated Profit (INR)</p>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(rd.totalProfitINR, 'INR')}</p>
                      <p className="text-xs text-green-500 mt-1">⚠️ Estimated — not realized cash profit</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="text-left py-2 px-3 text-gray-500">Party</th><th className="text-left py-2 px-3 text-gray-500">Country</th><th className="text-right py-2 px-3 text-gray-500">Sales Count</th><th className="text-right py-2 px-3 text-gray-500">Total Sales (INR)</th><th className="text-right py-2 px-3 text-gray-500">Est. Profit (INR)</th></tr></thead>
                      <tbody>
                        {rd.profitByParty?.map(p => (
                          <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium">{p.party?.name || 'Unknown'}</td>
                            <td className="py-2 px-3">{p.party?.country}</td>
                            <td className="py-2 px-3 text-right">{p.count}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(p.totalSalesINR, 'INR')}</td>
                            <td className="py-2 px-3 text-right text-green-600 font-semibold">{formatCurrency(p.totalProfitINR, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Exchange */}
                {reportType === 'exchange' && rd && (
                  <>
                    <div className="flex gap-4 mb-4 flex-wrap">
                      <div className="bg-purple-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-purple-600 font-medium">Total Net INR from Exchanges</p>
                        <p className="text-xl font-bold text-purple-800">{formatCurrency(rd.summary?.totalNetINR, 'INR')}</p>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="text-left py-2 px-3 text-gray-500">Date</th><th className="text-left py-2 px-3 text-gray-500">Party</th><th className="text-left py-2 px-3 text-gray-500">Currency</th><th className="text-right py-2 px-3 text-gray-500">Amount</th><th className="text-right py-2 px-3 text-gray-500">Rate</th><th className="text-right py-2 px-3 text-gray-500">Gross INR</th><th className="text-right py-2 px-3 text-gray-500">Fee</th><th className="text-right py-2 px-3 text-gray-500">Net INR</th></tr></thead>
                      <tbody>
                        {rd.exchanges?.map(e => (
                          <tr key={e._id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3">{formatDate(e.exchangeDate)}</td>
                            <td className="py-2 px-3">{e.party?.name || '-'}</td>
                            <td className="py-2 px-3">{e.foreignCurrency}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(e.foreignAmountExchanged, e.foreignCurrency)}</td>
                            <td className="py-2 px-3 text-right">₹{e.exchangeRate}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(e.grossINRAmount, 'INR')}</td>
                            <td className="py-2 px-3 text-right text-red-500">{e.exchangeFee > 0 ? formatCurrency(e.exchangeFee, 'INR') : '-'}</td>
                            <td className="py-2 px-3 text-right font-semibold text-green-600">{formatCurrency(e.netINRReceived, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Trend */}
                {reportType === 'trend' && rd && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-4">Monthly Sales Trend (INR)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={rd.salesTrend?.map(d => ({ name: `${d._id.year}-${String(d._id.month).padStart(2, '0')}`, Sales: d.totalINR, Count: d.count }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => formatCurrency(v, 'INR')} />
                        <Bar dataKey="Sales" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
