// Temporary check: does lucide-react dynamicIconImports list the icons?
const fs = require('fs');
const dyn = fs.readFileSync('node_modules/lucide-react/dynamicIconImports.js', 'utf8');
const cjs = fs.readFileSync('node_modules/lucide-react/dist/cjs/lucide-react.js', 'utf8');

const names = ['rotate-ccw', 'arrow-down-left', 'calendar', 'layers', 'filter', 'eye', 'credit-card', 'wallet', 'plus', 'search', 'chevron-left', 'chevron-right', 'trending-up', 'dollar-sign', 'check-circle', 'clock', 'coins', 'arrow-up-right', 'users'];
const pascal = { 'rotate-ccw': 'RotateCcw', 'arrow-down-left': 'ArrowDownLeft', 'calendar': 'Calendar', 'layers': 'Layers', 'filter': 'Filter', 'eye': 'Eye', 'credit-card': 'CreditCard', 'wallet': 'Wallet', 'plus': 'Plus', 'search': 'Search', 'chevron-left': 'ChevronLeft', 'chevron-right': 'ChevronRight', 'trending-up': 'TrendingUp', 'dollar-sign': 'DollarSign', 'check-circle': 'CheckCircle', 'clock': 'Clock', 'coins': 'Coins', 'arrow-up-right': 'ArrowUpRight', 'users': 'Users' };

console.log('--- dynamicIconImports.js ---');
for (const n of names) {
  const kebab = n;
  const camel = n.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
  console.log(`  ${n}: dyn(kebab)=${dyn.includes(kebab)} dyn(camel)=${dyn.includes(camel)}`);
}
console.log('--- cjs bundle ---');
for (const n of names) {
  const camel = pascal[n] || n.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
  console.log(`  ${camel}: ${cjs.includes(camel)}`);
}