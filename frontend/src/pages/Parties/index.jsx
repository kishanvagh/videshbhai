import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Edit2, Eye, Trash2, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getParties, updateParty, deleteParty } from '../../api/parties';
import TopBar from '../../components/Layout/TopBar';
import Modal from '../../components/UI/Modal';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import ConfirmDialog from '../../components/UI/ConfirmDialog';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import PartyForm from './PartyForm';
import { COUNTRIES } from '../../utils/formatters';

function PartyTable({ parties, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Party Name</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Type</th>
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
              <td className="py-3 px-4">
                {party.partyType === 'exchange' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                    Exchange
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gold-50 text-gold-700">
                    Sales
                  </span>
                )}
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
                    onClick={() => onEdit(party)}
                    className="p-1.5 rounded-lg hover:bg-gold-50 text-gray-500 hover:text-gold-600 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(party)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Parties() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [defaultPartyType, setDefaultPartyType] = useState('sales');
  const [partyToDelete, setPartyToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['parties', page, search, country],
    queryFn: () => getParties({ page, limit: 100, search, country }),
    keepPreviousData: true,
  });

  const handleDelete = async () => {
    if (!partyToDelete) return;
    try {
      setDeleting(true);
      await deleteParty(partyToDelete._id);
      toast.success('Party deleted successfully');
      setPartyToDelete(null);
      queryClient.invalidateQueries(['parties']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete party');
    } finally {
      setDeleting(false);
    }
  };

  const allParties = data?.data?.data?.parties || data?.data?.parties || [];
  const pagination = data?.data?.data?.pagination || data?.data?.pagination;

  const salesParties = allParties.filter(p => !p.partyType || p.partyType === 'sales');
  const exchangeParties = allParties.filter(p => p.partyType === 'exchange');

  const handleOpenAdd = (type) => {
    setEditParty(null);
    setDefaultPartyType(type);
    setShowForm(true);
  };

  const handleEdit = (party) => {
    setEditParty(party);
    setDefaultPartyType(party.partyType || 'sales');
    setShowForm(true);
  };

  return (
    <div>
      <TopBar title="Parties / Customers" subtitle="Manage your business contacts and customers" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="card">
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
          </div>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* Sales Parties Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-gold-500" />
                  <h2 className="text-base font-bold text-slate-800">Sales Parties</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{salesParties.length}</span>
                </div>
                <button onClick={() => handleOpenAdd('sales')} className="btn-primary flex items-center gap-2 text-xs py-1.5">
                  <Plus size={14} /> Add Sales Party
                </button>
              </div>
              {salesParties.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No sales parties found"
                  description="Add customers you sell items to"
                  action={<button onClick={() => handleOpenAdd('sales')} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Sales Party</button>}
                />
              ) : (
                <PartyTable parties={salesParties} onEdit={handleEdit} onDelete={setPartyToDelete} />
              )}
            </div>

            {/* Exchange Parties Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-purple-500" />
                  <h2 className="text-base font-bold text-slate-800">Currency Exchange Parties</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{exchangeParties.length}</span>
                </div>
                <button onClick={() => handleOpenAdd('exchange')} className="btn-primary flex items-center gap-2 text-xs py-1.5">
                  <Plus size={14} /> Add Exchange Party
                </button>
              </div>
              {exchangeParties.length === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="No exchange parties found"
                  description="Add currency exchange agents or brokers you work with"
                  action={<button onClick={() => handleOpenAdd('exchange')} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Exchange Party</button>}
                />
              ) : (
                <PartyTable parties={exchangeParties} onEdit={handleEdit} onDelete={setPartyToDelete} />
              )}
            </div>

            <Pagination page={page} totalPages={pagination?.pages || 1} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditParty(null); }}
        title={editParty ? 'Edit Party' : 'Add New Party'}
      >
        <PartyForm
          party={editParty}
          defaultPartyType={defaultPartyType}
          onSuccess={() => {
            setShowForm(false);
            setEditParty(null);
            queryClient.invalidateQueries(['parties']);
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!partyToDelete}
        onClose={() => setPartyToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Party?"
        message={`Are you sure you want to permanently delete "${partyToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Party"
        confirmClassName="btn-danger"
        loading={deleting}
      />
    </div>
  );
}
