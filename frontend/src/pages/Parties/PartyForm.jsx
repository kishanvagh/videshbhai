import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { createParty, updateParty } from '../../api/parties';
import { CURRENCIES, COUNTRIES } from '../../utils/formatters';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  country: z.string().min(1, 'Country is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  preferredCurrency: z.string().default('INR'),
  notes: z.string().optional(),
});

export default function PartyForm({ party, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: party ? {
      name: party.name,
      country: party.country,
      contactPerson: party.contactPerson || '',
      email: party.email || '',
      phone: party.phone || '',
      address: party.address || '',
      preferredCurrency: party.preferredCurrency || 'INR',
      notes: party.notes || '',
    } : { country: 'India', preferredCurrency: 'INR' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (party) {
        await updateParty(party._id, data);
        toast.success('Party updated successfully');
      } else {
        await createParty(data);
        toast.success('Party created successfully');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Party Name *</label>
          <input {...register('name')} className="input" placeholder="ABC Jewelry Store" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Country *</label>
          <select {...register('country')} className="input">
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Preferred Currency</label>
          <select {...register('preferredCurrency')} className="input">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Contact Person</label>
          <input {...register('contactPerson')} className="input" placeholder="John Smith" />
        </div>
        <div>
          <label className="label">Email</label>
          <input {...register('email')} type="email" className="input" placeholder="contact@example.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Phone</label>
          <input {...register('phone')} className="input" placeholder="+1 555-0000" />
        </div>
        <div className="col-span-2">
          <label className="label">Address</label>
          <input {...register('address')} className="input" placeholder="123 Main St, City, Country" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea {...register('notes')} className="input h-20 resize-none" placeholder="Additional notes..." />
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : party ? 'Update Party' : 'Create Party'}
        </button>
      </div>
    </form>
  );
}
