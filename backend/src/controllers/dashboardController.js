const accountingService = require('../services/accountingService');
const Party = require('../models/Party');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');
const mongoose = require('mongoose');

// @desc    Get dashboard summary cards
// @route   GET /api/dashboard/summary
const getSummary = async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      party: req.query.party,
    };
    const summary = await accountingService.getDashboardSummary(req.user.id, filters);
    return success(res, summary);
  } catch (err) {
    next(err);
  }
};

// @desc    Get party-wise accounting table for dashboard
// @route   GET /api/dashboard/party-table
const getPartyTable = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const filter = { user: userObjectId, isActive: true };
    if (req.query.country) filter.country = req.query.country;
    if (req.query.currency) filter.preferredCurrency = req.query.currency;
    if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

    const parties = await Party.find(filter).select('name country preferredCurrency email phone');

    const rows = [];
    for (const party of parties) {
      const balances = await accountingService.getPartyBalances(userId, party._id);

      const sales = await Sale.find({ user: userObjectId, party: party._id, status: { $ne: 'cancelled' } })
        .sort({ saleDate: -1 }).limit(1).select('saleDate');

      const payments = await Payment.find({ user: userObjectId, party: party._id, isReversed: false })
        .sort({ paymentDate: -1 }).limit(1).select('paymentDate');

      const lastSaleDate = sales.length ? sales[0].saleDate : null;
      const lastPaymentDate = payments.length ? payments[0].paymentDate : null;
      const lastTransaction = lastSaleDate && lastPaymentDate
        ? (lastSaleDate > lastPaymentDate ? lastSaleDate : lastPaymentDate)
        : (lastSaleDate || lastPaymentDate);

      const totalSalesINR = await Sale.aggregate([
        { $match: { user: userObjectId, party: party._id, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$saleAmountINR' }, profit: { $sum: '$estimatedProfitINR' } } }
      ]);
      const totalSalesINRVal = totalSalesINR.length ? decimal.round2(totalSalesINR[0].total) : 0;
      const profitINR = totalSalesINR.length ? decimal.round2(totalSalesINR[0].profit) : 0;

      // Per-currency profit breakdown (e.g. USD profit) for dual-currency display
      const profitByCurrencyAgg = await Sale.aggregate([
        { $match: { user: userObjectId, party: party._id, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$foreignCurrency',
            profitINR: { $sum: '$estimatedProfitINR' },
            profitForeign: { $sum: '$estimatedProfitForeign' }
          }
        }
      ]);
      const profitByCurrency = {};
      let totalProfitUSD = 0;
      profitByCurrencyAgg.forEach(g => {
        profitByCurrency[g._id || 'INR'] = {
          profitINR: decimal.round2(g.profitINR || 0),
          profitForeign: decimal.round2(g.profitForeign || 0)
        };
        if ((g._id || 'INR') !== 'INR') {
          totalProfitUSD = decimal.add(totalProfitUSD, g.profitForeign || 0);
        }
      });
      totalProfitUSD = decimal.round2(totalProfitUSD);

      // hasOutstanding
      const hasOutstanding = balances.some(b => b.outstanding > 0.01);

      if (req.query.status === 'outstanding' && !hasOutstanding) continue;
      if (req.query.status === 'settled' && hasOutstanding) continue;

      // Add INR received / outstanding / profit convenience fields
      let outstandingINR = 0;
      balances.forEach(b => {
        if (b.currency === 'INR') outstandingINR = decimal.add(outstandingINR, b.outstanding);
      });
      const receivedINR = Math.max(0, decimal.round2(decimal.subtract(totalSalesINRVal, outstandingINR)));

      rows.push({
        party: { _id: party._id, name: party.name, country: party.country, preferredCurrency: party.preferredCurrency },
        balances,
        totalSalesINR: totalSalesINRVal,
        totalReceivedINR: decimal.round2(receivedINR),
        outstandingINR: decimal.round2(outstandingINR),
        totalProfitINR: profitINR,
        totalProfitUSD,
        estimatedProfitINR: profitINR,
        profitByCurrency,
        lastTransaction,
        lastTransactionDate: lastTransaction,
        status: hasOutstanding ? 'partial' : 'settled',
        hasOutstanding,
      });
    }

    return success(res, { rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// @desc    Get currency position overview
// @route   GET /api/dashboard/currency-positions
const getCurrencyPositions = async (req, res, next) => {
  try {
    const holdings = await accountingService.getCurrencyHoldings(req.user.id);
    return success(res, { holdings });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getPartyTable, getCurrencyPositions };
