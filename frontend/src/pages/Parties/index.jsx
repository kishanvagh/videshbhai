import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Edit2, Eye, Power } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getParties, updateParty } from '../../api/parties';
import TopBar from '../../components/Layout/TopBar';
import Modal from '../../components/UI/Modal';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import PartyForm from './PartyForm';
import { COUNTRIES, CURRENCIES } from '../../utils/formatters';

export default function Parties() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editParty, setEditParty] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parties', page, search, country],
    queryFn: () => getParties({ page, limit: 20, search, country }),
    keepPreviousData: true,
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateParty(id, { isActive }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries(['parties']);
      toast.success(vars.isActive ? 'Party activated' : 'Party deactivated');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const parties = data?.data?.data?.parties || data?.data?.parties || [];
  const pagination = data?.data?.data?.pagination || data?.data?.pagination;

  return (
    <div>
      <TopBar
        title="Parties / Customers"
        subtitle="Manage your business contacts and customers"
      />

      <div className="p-6">
        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 flex-wrap flex-1">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search parties..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="input pl-9 w-56"
                />
              </div>
              <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} className="input w-40">
                <option value="">All Countries</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={() => { setEditParty(null); setShowForm(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add Party
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {isLoading ? (
            <PageLoader />
          ) : parties.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No parties found"
              description="Add your first customer or business contact"
              action={
                <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
                  <Plus size={16} /> Add Party
                </button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Party Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Country</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Currency</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map((party) => (
                      <tr key={party._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-700 font-bold text-sm">
                              {party.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800">{party.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{party.country}</td>
                        <td className="py-3 px-4 text-gray-600">{party.contactPerson || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{party.email || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            {party.preferredCurrency}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            party.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {party.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 justify-end">
                            <Link
                              to={`/parties/${party._id}`}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                              title="View Details"
                            >
                              <Eye size={15} />
                            </Link>
                            <button
                              onClick={() => { setEditParty(party); setShowForm(true); }}
                              className="p-1.5 rounded-lg hover:bg-gold-50 text-gray-500 hover:text-gold-600 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => deactivateMutation.mutate({ id: party._id, isActive: !party.isActive })}
                              className={`p-1.5 rounded-lg transition-colors ${
                                party.isActive
                                  ? 'hover:bg-red-50 text-gray-500 hover:text-red-500'
                                  : 'hover:bg-green-50 text-gray-500 hover:text-green-600'
                              }`}
                              title={party.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Power size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={pagination?.pages || 1} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditParty(null); }}
        title={editParty ? 'Edit Party' : 'Add New Party'}
      >
        <PartyForm
          party={editParty}
          onSuccess={() => {
            setShowForm(false);
            setEditParty(null);
            queryClient.invalidateQueries(['parties']);
          }}
        />
      </Modal>
    </div>
  );
}
