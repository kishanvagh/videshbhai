// Currency symbols
const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  AUD: 'A$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'AED ',
  OTHER: '',
};

export const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || (currency ? currency + ' ' : '');

export const formatCurrency = (amount, currency = 'INR', options = {}) => {
  if (amount === null || amount === undefined) return '-';
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  
  const symbol = getCurrencySymbol(currency);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  }).format(Math.abs(num));
  
  const sign = num < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
};

export const formatINR = (amount) => formatCurrency(amount, 'INR');

export const formatDate = (date) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

export const CURRENCIES = ['INR', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'AED', 'OTHER'];

export const COUNTRIES = [
  'India', 'USA', 'Australia', 'United Kingdom', 'Canada', 'Singapore', 'UAE', 'Germany', 'France', 'Other'
];

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wire_transfer', label: 'Wire Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
];
