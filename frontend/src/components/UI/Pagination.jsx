import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page = 1, totalPages = 1, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end pt-4">
      <button 
        type="button"
        onClick={() => onPageChange(page - 1)} 
        disabled={page <= 1} 
        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
      <button 
        type="button"
        onClick={() => onPageChange(page + 1)} 
        disabled={page >= totalPages} 
        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
