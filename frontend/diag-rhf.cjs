// Temporary check: react-hook-form + @hookform/resolvers exports used by the app
const rhf = require('react-hook-form');
console.log('react-hook-form keys:', Object.keys(rhf).slice(0, 30).join(', '));
console.log('typeof useForm:', typeof rhf.useForm);

try {
  const resolver = require('@hookform/resolvers/zod');
  console.log('@hookform/resolvers/zod keys:', Object.keys(resolver).join(', '));
  console.log('typeof zodResolver:', typeof resolver.zodResolver);
} catch (e) {
  console.log('zodResolver import ERROR:', e.message);
}

try {
  const resolver = require('@hookform/resolvers');
  console.log('@hookform/resolvers(root) keys:', Object.keys(resolver).join(', '));
} catch (e) {
  console.log('root import ERROR:', e.message);
}