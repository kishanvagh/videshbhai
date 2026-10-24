export default function StatusBadge({ status }) {
  const classes = {
    active: 'badge-active',
    partial: 'badge-partial',
    settled: 'badge-settled',
    cancelled: 'badge-cancelled',
    advance: 'badge-advance',
    overdue: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700',
    reversed: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500',
    pending: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700',
    completed: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700',
    allocated: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700',
    unallocated: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700',
  };
  const labels = {
    active: 'Active',
    partial: 'Partial',
    settled: 'Settled',
    cancelled: 'Cancelled',
    advance: 'Advance',
    overdue: 'Overdue',
    reversed: 'Reversed',
    pending: 'Pending',
    completed: 'Completed',
    allocated: 'Allocated',
    unallocated: 'Unallocated',
  };
  const normalized = status ? String(status).toLowerCase() : 'active';
  return <span className={classes[normalized] || 'badge-active'}>{labels[normalized] || status}</span>;
}
