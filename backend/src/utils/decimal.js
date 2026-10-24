/**
 * Decimal precision helpers for financial calculations.
 * Ensures consistent handling of floating-point arithmetic.
 */

const round2 = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  return Number(Math.round(Number(num + 'e+2')) + 'e-2');
};

const round10 = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  return parseFloat(num.toFixed(10));
};

const add = (a, b) => {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return round10(numA + numB);
};

const subtract = (a, b) => {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return round10(numA - numB);
};

const multiply = (a, b) => {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return round10(numA * numB);
};

const divide = (a, b) => {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  if (numB === 0) {
    throw new Error('Division by zero');
  }
  return round10(numA / numB);
};

module.exports = {
  round2,
  round10,
  add,
  subtract,
  multiply,
  divide
};
