// Temporary check: which lucide-react icons used across the app actually exist?
const lucide = require('lucide-react');
const names = ['RotateCcw','ArrowDownLeft','Calendar','Layers','Filter','Eye','CreditCard','Wallet','Plus','Search','ChevronLeft','ChevronRight','TrendingUp','DollarSign','CheckCircle','Clock','Coins','ArrowUpRight','Users','CreditCard','Layers','Filter','Eye','CreditCard','Wallet'];
const unique = [...new Set(names)];
const missing = [];
for (const n of unique) {
  if (typeof lucide[n] !== 'function') missing.push(n);
}
console.log('Checked', unique.length, 'icons. Missing:', missing.length ? missing.join(', ') : 'NONE');