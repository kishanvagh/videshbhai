import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, User, Building, Database, Save } from 'lucide-react';
import TopBar from '../../components/Layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import { getMe } from '../../api/auth';
import { getOpeningBalances, createOpeningBalance, deleteOpeningBalance } from '../../api/settings';
import { getParties } from '../../api/parties';
import { formatCurrency, formatDate, CURRENCIES } from '../../utils/formatters';
import api from '../../api/client';
import { PageLoader } from '../../components/UI/LoadingSpinner';
import Modal from '../../components/UI/Modal';

const profileSchema = z.object({
  name: z.string().min(2, 'Name required'),
  businessName: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(6, 'Min 6 characters'),
});

const obSchema = z.object({
  currency: z.string().min(1),
  amount: z.coerce.number().positive('Must be positive'),
  balanceType: z.enum(['receivable', 'cash_held', 'payable']),
  description: z.string().optional(),
  effectiveDate: z.string().min(1, 'Date required'),
  party: z.string().optional(),
});

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [showOBForm, setShowOBForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: partiesData } = useQuery({ queryKey: ['parties-list'], queryFn: () => getParties({ limit: 200 }) });
  const parties = partiesData?.data?.data?.parties || partiesData?.data?.parties || [];
  const { data: obData, isLoading: obLoading } = useQuery({
    queryKey: ['opening-balances'],
    queryFn: getOpeningBalances,
    enabled: activeTab === 'opening-balances',
  });

  const openingBalances = obData?.data?.balances || [];

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', businessName: user?.businessName || '' },
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });
  const obForm = useForm({ resolver: zodResolver(obSchema), defaultValues: { currency: 'USD', balanceType: 'receivable', effectiveDate: new Date().toISOString().split('T')[0] } });

  const handleProfileSave = async (data) => {
    setSaving(true);
    try {
      await api.put('/auth/profile', data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (data) => {
    setSaving(true);
    try {
      await api.put('/auth/change-password', data);
      toast.success('Password changed successfully');
      passwordForm.reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const createOBMutation = useMutation({
    mutationFn: createOpeningBalance,
    onSuccess: () => {
      toast.success('Opening balance added');
      queryClient.invalidateQueries(['opening-balances']);
      setShowOBForm(false);
      obForm.reset();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteOBMutation = useMutation({
    mutationFn: deleteOpeningBalance,
    onSuccess: () => {
      toast.success('Opening balance removed');
      queryClient.invalidateQueries(['opening-balances']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const TABS = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'opening-balances', label: 'Opening Balances', icon: Database },
  ];

  return (
    <div>
      <TopBar title="Settings" subtitle="Manage your account and business settings" />

      <div className="p-6">
        <div className="flex gap-6">
          {/* Tab sidebar */}
          <div className="w-52 flex-shrink-0 space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                  activeTab === key ? 'bg-gold-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />{label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {activeTab === 'profile' && (
              <>
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><User size={18} className="text-gold-500" /> Profile Information</h3>
                  <form onSubmit={profileForm.handleSubmit(handleProfileSave)} className="space-y-4 max-w-md">
                    <div>
                      <label className="label">Full Name</label>
                      <input {...profileForm.register('name')} className="input" />
                      {profileForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="label">Business Name</label>
                      <input {...profileForm.register('businessName')} className="input" placeholder="My Jewelry Business" />
                    </div>
                    <div>
                      <label className="label">Email Address</label>
                      <input value={user?.email || ''} disabled className="input bg-gray-50 cursor-not-allowed" />
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                      <Save size={14} />{saving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>
                </div>

                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-4">Change Password</h3>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4 max-w-md">
                    <div>
                      <label className="label">Current Password</label>
                      <input {...passwordForm.register('currentPassword')} type="password" className="input" />
                      {passwordForm.formState.errors.currentPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.currentPassword.message}</p>}
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input {...passwordForm.register('newPassword')} type="password" className="input" />
                      {passwordForm.formState.errors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>}
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                      <Save size={14} />{saving ? 'Saving...' : 'Change Password'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {activeTab === 'opening-balances' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Database size={18} className="text-gold-500" /> Opening Balances</h3>
                  <button onClick={() => setShowOBForm(true)} className="btn-primary text-sm">+ Add Opening Balance</button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Add opening balances for existing customers or foreign currency holdings when you start using this system.
                  These are clearly marked and don't create sales or payment records.
                </p>

                {obLoading ? <PageLoader /> : openingBalances.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Database size={40} className="mx-auto mb-2 text-gray-200" />
                    <p>No opening balances added yet</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left py-2 px-3 text-gray-500">Party</th><th className="text-left py-2 px-3 text-gray-500">Type</th><th className="text-right py-2 px-3 text-gray-500">Amount</th><th className="text-left py-2 px-3 text-gray-500">Currency</th><th className="text-left py-2 px-3 text-gray-500">Date</th><th className="text-left py-2 px-3 text-gray-500">Description</th><th className="text-right py-2 px-3 text-gray-500">Action</th></tr></thead>
                    <tbody>
                      {openingBalances.map(ob => (
                        <tr key={ob._id} className="border-b border-gray-50">
                          <td className="py-2 px-3">{ob.party?.name || <span className="text-gray-400">— (Central)</span>}</td>
                          <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.balanceType === 'receivable' ? 'bg-blue-100 text-blue-700' : ob.balanceType === 'cash_held' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{ob.balanceType.replace('_', ' ')}</span></td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(ob.amount, ob.currency)}</td>
                          <td className="py-2 px-3">{ob.currency}</td>
                          <td className="py-2 px-3">{formatDate(ob.effectiveDate)}</td>
                          <td className="py-2 px-3 text-gray-500">{ob.description || '-'}</td>
                          <td className="py-2 px-3 text-right">
                            <button onClick={() => { if (window.confirm('Delete this opening balance?')) deleteOBMutation.mutate(ob._id); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Opening Balance Form Modal */}
      <Modal isOpen={showOBForm} onClose={() => setShowOBForm(false)} title="Add Opening Balance">
        <form onSubmit={obForm.handleSubmit(data => createOBMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="label">Party (optional)</label>
            <select {...obForm.register('party')} className="input">
              <option value="">Central / No Party</option>
              {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Currency *</label>
              <select {...obForm.register('currency')} className="input">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount *</label>
              <input {...obForm.register('amount')} type="number" step="0.01" className="input" placeholder="0.00" />
              {obForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{obForm.formState.errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Balance Type *</label>
              <select {...obForm.register('balanceType')} className="input">
                <option value="receivable">Receivable (owed to you)</option>
                <option value="cash_held">Cash Held (foreign currency)</option>
                <option value="payable">Payable (you owe)</option>
              </select>
            </div>
            <div>
              <label className="label">Effective Date *</label>
              <input {...obForm.register('effectiveDate')} type="date" className="input" />
              {obForm.formState.errors.effectiveDate && <p className="text-red-500 text-xs mt-1">{obForm.formState.errors.effectiveDate.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input {...obForm.register('description')} className="input" placeholder="e.g. Outstanding balance from 2023" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowOBForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createOBMutation.isPending} className="btn-primary">
              {createOBMutation.isPending ? 'Adding...' : 'Add Opening Balance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
