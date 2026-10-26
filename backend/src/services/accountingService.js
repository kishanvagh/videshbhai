const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const CurrencyExchange = require('../models/CurrencyExchange');
const OpeningBalance = require('../models/OpeningBalance');
const Party = require('../models/Party');
const decimal = require('../utils/decimal');

/**
 * Get outstanding balance for a specific sale
 * @param {string|ObjectId} saleId
 * @returns {Promise<Object>}
 */
async function getSaleOutstanding(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  // Sum all non-reversed PaymentAllocations for this sale
  const allocations = await PaymentAllocation.find({
    sale: saleId,
    isReversed: false
  });

  const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;

  let allocatedForeign = 0;
  let allocatedINR = 0;

  for (const alloc of allocations) {
    if (isForeign) {
      if (alloc.currency === sale.foreignCurrency) {
        allocatedForeign = decimal.add(allocatedForeign, alloc.allocatedAmount);
      } else if (alloc.isCrossCurrency && alloc.settlementAmountInSaleCurrency) {
        allocatedForeign = decimal.add(allocatedForeign, alloc.settlementAmountInSaleCurrency);
      } else if (alloc.currency === 'INR' && sale.saleAmountINR > 0) {
        // Proportionate settlement based on INR
        const impliedForeign = decimal.divide(
          decimal.multiply(alloc.allocatedAmount, sale.saleAmountForeign),
          sale.saleAmountINR
        );
        allocatedForeign = decimal.add(allocatedForeign, impliedForeign);
      }
    } else {
      // INR Sale
      if (alloc.currency === 'INR') {
        allocatedINR = decimal.add(allocatedINR, alloc.allocatedAmount);
      } else if (alloc.settlementAmountInSaleCurrency) {
        allocatedINR = decimal.add(allocatedINR, alloc.settlementAmountInSaleCurrency);
      } else if (alloc.isCrossCurrency && alloc.exchangeRateUsed) {
        const inrAmount = decimal.multiply(alloc.allocatedAmount, alloc.exchangeRateUsed);
        allocatedINR = decimal.add(allocatedINR, inrAmount);
      }
    }
  }

  allocatedForeign = decimal.round2(allocatedForeign);
  allocatedINR = decimal.round2(allocatedINR);

  let outstandingForeign = 0;
  let outstandingINR = 0;

  if (isForeign) {
    outstandingForeign = Math.max(0, decimal.subtract(sale.saleAmountForeign, allocatedForeign));
    outstandingForeign = decimal.round2(outstandingForeign);
    
    // Calculate proportional INR outstanding
    const ratio = sale.saleAmountForeign > 0 ? (allocatedForeign / sale.saleAmountForeign) : 1;
    allocatedINR = decimal.round2(sale.saleAmountINR * Math.min(1, ratio));
    outstandingINR = Math.max(0, decimal.round2(decimal.subtract(sale.saleAmountINR, allocatedINR)));
  } else {
    outstandingINR = Math.max(0, decimal.subtract(sale.saleAmountINR, allocatedINR));
    outstandingINR = decimal.round2(outstandingINR);
    allocatedForeign = 0;
    outstandingForeign = 0;
  }

  return {
    saleId: sale._id,
    invoiceNumber: sale.invoiceNumber,
    foreignCurrency: sale.foreignCurrency,
    totalSaleINR: sale.saleAmountINR,
    totalSaleForeign: sale.saleAmountForeign,
    allocatedINR,
    allocatedForeign,
    outstandingINR,
    outstandingForeign,
    status: sale.status
  };
}

/**
 * Recalculate and update sale status in database based on current allocations
 * @param {string|ObjectId} saleId
 * @param {ClientSession} session - optional mongoose session
 * @returns {Promise<string>}
 */
async function recalculateSaleStatus(saleId, session = null) {
  const query = Sale.findById(saleId);
  if (session) query.session(session);
  const sale = await query;

  if (!sale) {
    throw new Error('Sale not found');
  }

  if (sale.status === 'cancelled') {
    return 'cancelled';
  }

  const { outstandingForeign, outstandingINR, allocatedForeign, allocatedINR } = await getSaleOutstanding(saleId);

  const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;
  let newStatus = 'active';

  if (isForeign) {
    if (outstandingForeign <= 0.01) {
      newStatus = 'settled';
    } else if (allocatedForeign > 0.01) {
      newStatus = 'partial';
    } else {
      newStatus = 'active';
    }
  } else {
    if (outstandingINR <= 0.01) {
      newStatus = 'settled';
    } else if (allocatedINR > 0.01) {
      newStatus = 'partial';
    } else {
      newStatus = 'active';
    }
  }

  if (sale.status !== newStatus) {
    sale.status = newStatus;
    if (session) {
      await sale.save({ session });
    } else {
      await sale.save();
    }
  }

  return newStatus;
}

/**
 * Get currency balances for a party
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} partyId
 * @returns {Promise<Array>}
 */
async function getPartyBalances(userId, partyId) {
  const partyObjectId = new mongoose.Types.ObjectId(partyId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Fetch all active/partial/settled sales
  const sales = await Sale.find({
    user: userObjectId,
    party: partyObjectId,
    status: { $ne: 'cancelled' }
  });

  // 2. Fetch all non-reversed payments
  const payments = await Payment.find({
    user: userObjectId,
    party: partyObjectId,
    isReversed: false
  });

  // 3. Fetch all non-reversed allocations for this party's sales or payments
  const paymentIds = payments.map(p => p._id);
  const saleIds = sales.map(s => s._id);

  const allocations = await PaymentAllocation.find({
    user: userObjectId,
    $or: [{ payment: { $in: paymentIds } }, { sale: { $in: saleIds } }],
    isReversed: false
  });

  // Identify all currencies involved
  const currencySet = new Set(['INR']);
  sales.forEach(s => {
    if (s.foreignCurrency) currencySet.add(s.foreignCurrency);
  });
  payments.forEach(p => {
    if (p.currency) currencySet.add(p.currency);
  });

  // Calculate unallocated payment amount (advance) per currency
  const advanceByCurrency = {};
  for (const curr of currencySet) {
    advanceByCurrency[curr] = 0;
  }

  for (const payment of payments) {
    const paymentAllocs = allocations.filter(a => a.payment.toString() === payment._id.toString());
    const totalAllocatedFromPayment = paymentAllocs.reduce((sum, a) => decimal.add(sum, a.allocatedAmount), 0);
    const unallocated = Math.max(0, decimal.subtract(payment.amountReceived, totalAllocatedFromPayment));
    if (unallocated > 0.001) {
      advanceByCurrency[payment.currency] = decimal.add(advanceByCurrency[payment.currency] || 0, unallocated);
    }
  }

  // Calculate totalSales, totalAllocated, and outstanding per currency
  const resultByCurrency = {};
  for (const curr of currencySet) {
    resultByCurrency[curr] = {
      currency: curr,
      totalSales: 0,
      totalAllocated: 0,
      outstanding: 0,
      advance: decimal.round2(advanceByCurrency[curr] || 0)
    };
  }

  for (const sale of sales) {
    const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;
    const saleAllocations = allocations.filter(a => a.sale.toString() === sale._id.toString());

    if (isForeign) {
      const curr = sale.foreignCurrency;
      let allocForThisSale = 0;
      for (const a of saleAllocations) {
        if (a.currency === curr) {
          allocForThisSale = decimal.add(allocForThisSale, a.allocatedAmount);
        } else if (a.isCrossCurrency && a.settlementAmountInSaleCurrency) {
          allocForThisSale = decimal.add(allocForThisSale, a.settlementAmountInSaleCurrency);
        }
      }
      resultByCurrency[curr].totalSales = decimal.add(resultByCurrency[curr].totalSales, sale.saleAmountForeign);
      resultByCurrency[curr].totalAllocated = decimal.add(resultByCurrency[curr].totalAllocated, allocForThisSale);
    } else {
      let allocForThisSale = 0;
      for (const a of saleAllocations) {
        if (a.currency === 'INR') {
          allocForThisSale = decimal.add(allocForThisSale, a.allocatedAmount);
        } else if (a.settlementAmountInSaleCurrency) {
          allocForThisSale = decimal.add(allocForThisSale, a.settlementAmountInSaleCurrency);
        }
      }
      resultByCurrency['INR'].totalSales = decimal.add(resultByCurrency['INR'].totalSales, sale.saleAmountINR);
      resultByCurrency['INR'].totalAllocated = decimal.add(resultByCurrency['INR'].totalAllocated, allocForThisSale);
    }
  }

  // Finalize totals and calculate outstanding
  const balances = Object.values(resultByCurrency).map(item => {
    item.totalSales = decimal.round2(item.totalSales);
    item.totalAllocated = decimal.round2(item.totalAllocated);
    item.outstanding = Math.max(0, decimal.round2(decimal.subtract(item.totalSales, item.totalAllocated)));
    return item;
  });

  return balances;
}

/**
 * Compute how a received payment should be auto-applied against a party's
 * outstanding invoices. Allocates against the oldest unsettled sales first,
 * limited to the payment amount, and only for invoices in the same currency
 * as the payment.
 *
 * @param {string} userId
 * @param {string} partyId
 * @param {number} amount - payment amount received
 * @param {string} paymentCurrency
 * @returns {Promise<Array<{sale: string, allocatedAmount: number}>>}
 */
async function computeAutoPaymentAllocation(userId, partyId, amount, paymentCurrency) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const sales = await Sale.find({
    user: userObjectId,
    party: partyId,
    status: { $in: ['active', 'partial'] },
    foreignCurrency: paymentCurrency
  }).sort({ saleDate: 1, createdAt: 1 });

  const allocations = [];
  let remaining = parseFloat(amount) || 0;

  for (const sale of sales) {
    if (remaining <= 0.001) break;

    const outstanding = await getSaleOutstanding(sale._id);
    const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && parseFloat(sale.saleAmountForeign || 0) > 0;
    const outstandingAmt = parseFloat(isForeign ? (outstanding.outstandingForeign || 0) : (outstanding.outstandingINR || 0));

    if (outstandingAmt <= 0.001) continue;

    const alloc = decimal.round2(Math.min(outstandingAmt, remaining));
    if (alloc > 0) {
      allocations.push({ sale: sale._id, allocatedAmount: alloc });
      remaining = decimal.round2(decimal.subtract(remaining, alloc));
    }
  }

  return allocations;
}

/**
 * Get foreign currency holdings for a user
 * @param {string|ObjectId} userId
 * @param {string} [currency] - Optional specific currency
 * @returns {Promise<Object|Array>}
 */
async function getCurrencyHoldings(userId, currency = null) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const foreignCurrencies = currency ? [currency] : ['USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'AED', 'OTHER'];

  const results = [];

  for (const curr of foreignCurrencies) {
    // 1. Total payments received in this currency
    const paymentAgg = await Payment.aggregate([
      {
        $match: {
          user: userObjectId,
          currency: curr,
          isReversed: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountReceived' }
        }
      }
    ]);
    const totalPaymentsReceived = paymentAgg.length > 0 ? paymentAgg[0].total : 0;

    // 2. Opening cash_held balances in this currency
    const openingAgg = await OpeningBalance.aggregate([
      {
        $match: {
          user: userObjectId,
          currency: curr,
          balanceType: 'cash_held'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const openingCashHeld = openingAgg.length > 0 ? openingAgg[0].total : 0;

    // 3. Currency exchanges out of this currency
    const exchangeAgg = await CurrencyExchange.aggregate([
      {
        $match: {
          user: userObjectId,
          foreignCurrency: curr,
          isReversed: false
        }
      },
      {
        $group: {
          _id: null,
          totalExchanged: { $sum: '$foreignAmountExchanged' },
          totalGrossINR: { $sum: '$grossINRAmount' },
          totalNetINR: { $sum: '$netINRReceived' }
        }
      }
    ]);
    const totalExchanged = exchangeAgg.length > 0 ? exchangeAgg[0].totalExchanged : 0;
    const grossINRFromExchanges = exchangeAgg.length > 0 ? exchangeAgg[0].totalGrossINR : 0;
    const netINRFromExchanges = exchangeAgg.length > 0 ? exchangeAgg[0].totalNetINR : 0;

    const totalReceived = decimal.add(totalPaymentsReceived, openingCashHeld);
    const currentHolding = decimal.round2(Math.max(0, decimal.subtract(totalReceived, totalExchanged)));

    results.push({
      currency: curr,
      totalPaymentsReceived: decimal.round2(totalPaymentsReceived),
      openingCashHeld: decimal.round2(openingCashHeld),
      totalReceived: decimal.round2(totalReceived),
      totalExchanged: decimal.round2(totalExchanged),
      grossINRFromExchanges: decimal.round2(grossINRFromExchanges),
      netINRFromExchanges: decimal.round2(netINRFromExchanges),
      currentHolding
    });
  }

  return currency ? results[0] : results;
}

/**
 * Get the full currency wallet for a user.
 * Any payment received from any party in any currency (including INR) is added
 * to the wallet and is available for currency exchange.
 * @param {string|ObjectId} userId
 * @returns {Promise<Array>}
 */
async function getWalletBalances(userId) {
  const holdings = await getCurrencyHoldings(userId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // INR is part of the wallet too (received INR payments + opening cash held +
  // INR received from currency exchanges). INR is never exchanged out, so totalExchanged stays 0.
  const inrPaymentAgg = await Payment.aggregate([
    { $match: { user: userObjectId, currency: 'INR', isReversed: false } },
    { $group: { _id: null, total: { $sum: '$amountReceived' } } }
  ]);
  const inrPaymentsReceived = inrPaymentAgg.length > 0 ? inrPaymentAgg[0].total : 0;

  const inrOpeningAgg = await OpeningBalance.aggregate([
    { $match: { user: userObjectId, currency: 'INR', balanceType: 'cash_held' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const inrOpeningCashHeld = inrOpeningAgg.length > 0 ? inrOpeningAgg[0].total : 0;

  const inrFromExchangesAgg = await CurrencyExchange.aggregate([
    { $match: { user: userObjectId, isReversed: false } },
    {
      $group: {
        _id: null,
        received: { $sum: '$inrReceivedAmount' },
        pending: { $sum: '$inrPendingAmount' },
        gross: { $sum: '$netINRReceived' }
      }
    }
  ]);
  // Only the INR actually received from the exchange party counts towards the INR wallet.
  // Pending/due amounts (e.g. party paid only 50%) are tracked separately.
  const inrReceivedFromExchanges = inrFromExchangesAgg.length > 0 ? inrFromExchangesAgg[0].received : 0;
  const inrPendingFromExchanges = inrFromExchangesAgg.length > 0 ? inrFromExchangesAgg[0].pending : 0;

  const inrTotalReceived = decimal.add(
    decimal.add(inrPaymentsReceived, inrOpeningCashHeld),
    inrReceivedFromExchanges
  );

  holdings.push({
    currency: 'INR',
    totalPaymentsReceived: decimal.round2(inrPaymentsReceived),
    openingCashHeld: decimal.round2(inrOpeningCashHeld),
    totalReceived: decimal.round2(inrTotalReceived),
    totalExchanged: 0,
    grossINRFromExchanges: decimal.round2(inrReceivedFromExchanges),
    netINRFromExchanges: decimal.round2(inrReceivedFromExchanges),
    pendingFromExchanges: decimal.round2(inrPendingFromExchanges),
    currentHolding: decimal.round2(inrTotalReceived)
  });

  return holdings;
}

/**
 * Get comprehensive dashboard summary
 * @param {string|ObjectId} userId
 * @param {Object} filters
 * @returns {Promise<Object>}
 */
async function getDashboardSummary(userId, filters = {}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const matchFilter = { user: userObjectId };

  if (filters.startDate || filters.endDate) {
    matchFilter.saleDate = {};
    if (filters.startDate) matchFilter.saleDate.$gte = new Date(filters.startDate);
    if (filters.endDate) matchFilter.saleDate.$lte = new Date(filters.endDate);
  }

  if (filters.party) {
    matchFilter.party = new mongoose.Types.ObjectId(filters.party);
  }

  // 1. Sales Aggregation
  const salesAgg = await Sale.aggregate([
    { $match: { ...matchFilter, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$foreignCurrency',
        count: { $sum: 1 },
        totalINR: { $sum: '$saleAmountINR' },
        totalForeign: { $sum: '$saleAmountForeign' },
        totalProfitINR: { $sum: '$estimatedProfitINR' },
        totalProfitForeign: { $sum: '$estimatedProfitForeign' }
      }
    }
  ]);

  // Overall totals in INR
  let totalSalesINR = 0;
  let totalProfitINR = 0;
  let totalSalesCount = 0;
  // USD-first totals (sales are primarily recorded in USD)
  let totalSalesUSD = 0;
  let totalProfitUSD = 0;
  const salesByCurrency = {};
  const profitByCurrency = {};

  salesAgg.forEach(group => {
    totalSalesINR = decimal.add(totalSalesINR, group.totalINR);
    totalProfitINR = decimal.add(totalProfitINR, group.totalProfitINR);
    totalSalesUSD = decimal.add(totalSalesUSD, group.totalForeign);
    totalProfitUSD = decimal.add(totalProfitUSD, group.totalProfitForeign);
    totalSalesCount += group.count;
    const currency = group._id || 'INR';
    salesByCurrency[currency] = {
      count: group.count,
      totalINR: decimal.round2(group.totalINR),
      totalForeign: decimal.round2(group.totalForeign),
      profitINR: decimal.round2(group.totalProfitINR)
    };
    profitByCurrency[currency] = {
      profitINR: decimal.round2(group.totalProfitINR || 0),
      profitForeign: decimal.round2(group.totalProfitForeign || 0)
    };
  });

  // 2. Payments Aggregation
  const paymentFilter = { user: userObjectId, isReversed: false };
  if (filters.startDate || filters.endDate) {
    paymentFilter.paymentDate = {};
    if (filters.startDate) paymentFilter.paymentDate.$gte = new Date(filters.startDate);
    if (filters.endDate) paymentFilter.paymentDate.$lte = new Date(filters.endDate);
  }
  if (filters.party) {
    paymentFilter.party = new mongoose.Types.ObjectId(filters.party);
  }

  const paymentAgg = await Payment.aggregate([
    { $match: paymentFilter },
    {
      $group: {
        _id: '$currency',
        count: { $sum: 1 },
        totalReceived: { $sum: '$amountReceived' }
      }
    }
  ]);

  const paymentsByCurrency = {};
  let paymentsCount = 0;
  let totalReceivedINR = 0;
  let totalReceivedUSD = 0;
  paymentAgg.forEach(group => {
    paymentsCount += group.count;
    // Only INR receipts count towards the INR total; foreign amounts are
    // reported per-currency in paymentsByCurrency (cannot be summed as INR).
    if (group._id === 'INR') {
      totalReceivedINR = decimal.add(totalReceivedINR, group.totalReceived);
    } else {
      totalReceivedUSD = decimal.add(totalReceivedUSD, group.totalReceived);
    }
    paymentsByCurrency[group._id] = {
      count: group.count,
      totalReceived: decimal.round2(group.totalReceived)
    };
  });

  // 3. Outstanding calculation by party
  const parties = await Party.find({ user: userObjectId, isActive: true }).select('name country preferredCurrency');
  const partySummaries = [];

  for (const party of parties) {
    const balances = await getPartyBalances(userId, party._id);
    const partySales = await Sale.find({ user: userObjectId, party: party._id, status: { $ne: 'cancelled' } });
    const profitINR = partySales.reduce((sum, s) => decimal.add(sum, s.estimatedProfitINR || 0), 0);

    let totalINR = 0;
    let outstandingINR = 0;
    balances.forEach(b => {
      if (b.currency === 'INR') {
        outstandingINR = decimal.add(outstandingINR, b.outstanding);
      }
    });

    partySales.forEach(s => {
      totalINR = decimal.add(totalINR, s.saleAmountINR);
    });

    partySummaries.push({
      partyId: party._id,
      name: party.name,
      country: party.country,
      preferredCurrency: party.preferredCurrency,
      balances,
      totalSalesINR: decimal.round2(totalINR),
      profitINR: decimal.round2(profitINR)
    });
  }

  // 4. Currency Holdings
  const currencyHoldings = await getCurrencyHoldings(userId);

  // 5. Currency Exchanges total
  const exchangeAgg = await CurrencyExchange.aggregate([
    { $match: { user: userObjectId, isReversed: false } },
    {
      $group: {
        _id: null,
        totalNetINR: { $sum: '$netINRReceived' },
        totalGrossINR: { $sum: '$grossINRAmount' },
        totalFees: { $sum: '$exchangeFee' }
      }
    }
  ]);

  const inrFromExchanges = exchangeAgg.length > 0 ? {
    netINR: decimal.round2(exchangeAgg[0].totalNetINR),
    grossINR: decimal.round2(exchangeAgg[0].totalGrossINR),
    exchangeFees: decimal.round2(exchangeAgg[0].totalFees)
  } : { netINR: 0, grossINR: 0, exchangeFees: 0 };

  // Outstanding by currency across all active parties
  const outstandingByCurrency = {};
  let totalOutstandingINR = 0;
  let totalOutstandingUSD = 0;
  partySummaries.forEach((ps) => {
    (ps.balances || []).forEach((b) => {
      if (b.outstanding > 0.001) {
        outstandingByCurrency[b.currency] = decimal.round2(
          decimal.add(outstandingByCurrency[b.currency] || 0, b.outstanding)
        );
        if (b.currency === 'INR') {
          totalOutstandingINR = decimal.add(totalOutstandingINR, b.outstanding);
        } else {
          totalOutstandingUSD = decimal.add(totalOutstandingUSD, b.outstanding);
        }
      }
    });
  });

  const overview = {
    totalSalesINR: decimal.round2(totalSalesINR),
    totalProfitINR: decimal.round2(totalProfitINR),
    totalSalesUSD: decimal.round2(totalSalesUSD),
    totalProfitUSD: decimal.round2(totalProfitUSD),
    totalReceivedUSD: decimal.round2(totalReceivedUSD),
    totalOutstandingUSD: decimal.round2(totalOutstandingUSD),
    inrFromExchanges: inrFromExchanges.netINR,
    totalSalesCount,
    paymentsCount,
    totalReceivedINR: decimal.round2(totalReceivedINR),
    totalOutstandingINR: decimal.round2(totalOutstandingINR)
  };

  return {
    overview,
    // Top-level aliases (kept for backwards compatibility with older clients)
    totalSalesINR: overview.totalSalesINR,
    totalProfitINR: overview.totalProfitINR,
    totalSalesUSD: overview.totalSalesUSD,
    totalProfitUSD: overview.totalProfitUSD,
    totalReceivedUSD: overview.totalReceivedUSD,
    totalOutstandingUSD: overview.totalOutstandingUSD,
    totalSalesCount,
    paymentsCount,
    totalReceivedINR: overview.totalReceivedINR,
    totalOutstandingINR: overview.totalOutstandingINR,
    outstandingByCurrency,
    salesByCurrency,
    profitByCurrency,
    paymentsByCurrency,
    currencyHoldings,
    inrFromExchanges,
    partySummaries
  };
}

module.exports = {
  getSaleOutstanding,
  recalculateSaleStatus,
  getPartyBalances,
  computeAutoPaymentAllocation,
  getCurrencyHoldings,
  getWalletBalances,
  getDashboardSummary
};
