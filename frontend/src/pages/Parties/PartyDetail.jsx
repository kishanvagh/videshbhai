import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Mail, Phone, Globe } from 'lucide-react';
import { getParty, getPartyLedger, getPartyBalances } from '../../api/parties';
import { getSales } from '../../api/sales';
import { getPayments } from '../../api/payments';
import TopBar from '../../components/Layout/TopBar';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import { formatCurrency, formatDate, getCurrencySymbol } from '../../utils/formatters';

const TABS = ['Balances', 'Ledger', 'Sales', 'Payments'];

export default function PartyDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('Balances');

  const { data: partyData, isLoading: partyLoading } = useQuery({
    queryKey: ['party', id],
    queryFn: () => getParty(id),
  });

  const { data: ledgerData } = useQuery({
    queryKey: ['party-ledger', id],
    queryFn: () => getPartyLedger(id),
    enabled: tab === 'Ledger',
  });

  const { data: salesData } = useQuery({
    queryKey: ['party-sales', id],
    queryFn: () => getSales({ party: id, limit: 100 }),
    enabled: tab === 'Sales',
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['party-payments', id],
    queryFn: () => getPayments({ party: id, limit: 100 }),
    enabled: tab === 'Payments',
  });

  if (partyLoading) return <PageLoader />;

  const party = partyData?.data?.party;
  const balances = partyData?.data?.balances || [];

  if (!party) return <div className="p-6 text-gray-500">Party not found</div>;

  return (
    <div>
      <TopBar title={party.name} subtitle={`${party.country} • ${party.preferredCurrency}`} />

      <div className="p-6 space-y-6">
        {/* Back */}
        <Link to="/parties" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={16} /> Back to Parties
        </Link>

        {/* Header card */}
        <div className="card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gold-100 flex items-center justify-center text-gold-700 font-bold text-xl">
                {party.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{party.name}</h2>
                <div className="flex gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                  {party.country && <span className="flex items-center gap-1"><Globe size={13} />{party.country}</span>}
                  {party.email && <span className="flex items-center gap-1"><Mail size={13} />{party.email}</span>}
                  {party.phone && <span className="flex items-center gap-1"><Phone size={13} />{party.phone}</span>}
                </div>
                {party.contactPerson && <p className="text-sm text-gray-500 mt-0.5">Contact: {party.contactPerson}</p>}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${party.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {party.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Balance Cards */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Account Balances</h3>
          {balances.length === 0 ? (
            <div className="card text-center text-gray-400 py-8">No transactions yet</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {balances.map((bal) => (
                <div key={bal.currency} className="card border-l-4 border-l-gold-400">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-600">{bal.currency} Account</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bal.outstanding > 0.01 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {bal.outstanding > 0.01 ? 'Outstanding' : 'Settled'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Sales</span>
                      <span className="font-semibold">{formatCurrency(bal.totalSales, bal.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Received</span>
                      <span className="font-semibold text-green-600">{formatCurrency(bal.totalAllocated, bal.currency)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-medium">Outstanding</span>
                      <span className={`font-bold ${bal.outstanding > 0.01 ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatCurrency(bal.outstanding, bal.currency)}
                      </span>
                    </div>
                    {bal.advance > 0.01 && (
                      <div className="flex justify-between">
                        <span className="text-purple-600 text-xs">Advance Held</span>
                        <span className="text-purple-600 text-xs font-medium">{formatCurrency(bal.advance, bal.currency)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="card">
          <div className="flex gap-1 border-b border-gray-100 mb-4">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t ? 'text-gold-600 border-b-2 border-gold-500' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Ledger Tab */}
          {tab === 'Ledger' && (
            <div className="overflow-x-auto">
              {!ledgerData ? <PageLoader /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Debit</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Credit</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Ccy</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData?.data?.ledger?.map((entry, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600">{formatDate(entry.date)}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            entry.type === 'sale' ? 'bg-blue-50 text-blue-600' :
                            entry.type === 'payment' ? 'bg-green-50 text-green-600' :
                            entry.type === 'exchange' ? 'bg-purple-50 text-purple-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-700 max-w-xs truncate">{entry.description}</td>
                        <td className="py-2 px-3 text-right text-slate-800 font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit, entry.currency) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-green-600 font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit, entry.currency) : '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-500">{entry.currency}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${entry.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(entry.balance), entry.currency)}
                        </td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{entry.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Sales Tab */}
          {tab === 'Sales' && (
            <div className="overflow-x-auto">
              {!salesData ? <PageLoader /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Invoice</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Product</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">INR</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Foreign</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData?.data?.sales?.map((s) => (
                      <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs text-blue-600">{s.invoiceNumber}</td>
                        <td className="py-2 px-3 text-gray-600">{formatDate(s.saleDate)}</td>
                        <td className="py-2 px-3 font-medium">{s.productName}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(s.saleAmountINR, 'INR')}</td>
                        <td className="py-2 px-3 text-right">
                          {s.saleAmountForeign > 0 ? formatCurrency(s.saleAmountForeign, s.foreignCurrency) : '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.status === 'settled' ? 'bg-green-100 text-green-700' :
                            s.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            s.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {tab === 'Payments' && (
            <div className="overflow-x-auto">
              {!paymentsData ? <PageLoader /> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Currency</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Method</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Reference</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsData?.data?.payments?.map((p) => (
                      <tr key={p._id} className={`border-b border-gray-50 hover:bg-gray-50 ${p.isReversed ? 'opacity-50' : ''}`}>
                        <td className="py-2 px-3 text-gray-600">{formatDate(p.paymentDate)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-green-600">{formatCurrency(p.amountReceived, p.currency)}</td>
                        <td className="py-2 px-3 text-gray-600">{p.currency}</td>
                        <td className="py-2 px-3 text-gray-600 capitalize">{p.paymentMethod?.replace('_', ' ')}</td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{p.bankReference || '-'}</td>
                        <td className="py-2 px-3">
                          {p.isReversed ? (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Reversed</span>
                          ) : p.isAdvance ? (
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Advance</span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Applied</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Balances tab (default) */}
          {tab === 'Balances' && (
            <div className="text-sm text-gray-500 text-center py-4">
              Balance summary shown above the tabs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
