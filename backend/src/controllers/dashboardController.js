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
    const partyIds = parties.map(p => p._id);
    if (parties.length === 0) return success(res, { rows: [], total: 0 });

    // Batched balances for ALL parties (avoids the previous N+1 query loop)
    const balMap = await accountingService.getAllPartyBalances(userId, partyIds);

    // All non-cancelled sales for all parties (single query)
    const allSales = await Sale.find({
      user: userObjectId,
      party: { $in: partyIds },
      status: { $ne: 'cancelled' }
    }).select('party saleDate saleAmountINR saleAmountForeign estimatedProfitINR estimatedProfitForeign foreignCurrency');

    // All non-reversed payments for all parties (single query)
    const allPayments = await Payment.find({
      user: userObjectId,
      party: { $in: partyIds },
      isReversed: false
    }).select('party paymentDate');

    const key = (id) => String(id);
    const salesPerParty = {};
    const latestSalePerParty = {};
    const latestPaymentPerParty = {};
    partyIds.forEach(pid => { salesPerParty[key(pid)] = []; });

    allSales.forEach(s => {
      const k = key(s.party);
      if (!salesPerParty[k]) return;
      salesPerParty[k].push(s);
      const d = s.saleDate;
      if (!latestSalePerParty[k] || d > latestSalePerParty[k]) latestSalePerParty[k] = d;
    });
    allPayments.forEach(p => {
      const k = key(p.party);
      const d = p.paymentDate;
      if (!latestPaymentPerParty[k] || d > latestPaymentPerParty[k]) latestPaymentPerParty[k] = d;
    });

    const rows = [];
    for (const party of parties) {
      const k = key(party._id);
      const balances = balMap[k] || [];
      const partySales = salesPerParty[k] || [];

      const lastSaleDate = latestSalePerParty[k] || null;
      const lastPaymentDate = latestPaymentPerParty[k] || null;
      const lastTransaction = lastSaleDate && lastPaymentDate
        ? (lastSaleDate > lastPaymentDate ? lastSaleDate : lastPaymentDate)
        : (lastSaleDate || lastPaymentDate);

      let totalSalesINR = 0;
      let profitINR = 0;
      let totalProfitUSD = 0;
      const profitByCurrency = {};
      partySales.forEach(s => {
        totalSalesINR = decimal.add(totalSalesINR, s.saleAmountINR);
        profitINR = decimal.add(profitINR, s.estimatedProfitINR);
        const c = s.foreignCurrency || 'INR';
        profitByCurrency[c] = profitByCurrency[c] || { profitINR: 0, profitForeign: 0 };
        profitByCurrency[c].profitINR = decimal.add(profitByCurrency[c].profitINR, s.estimatedProfitINR || 0);
        profitByCurrency[c].profitForeign = decimal.add(profitByCurrency[c].profitForeign, s.estimatedProfitForeign || 0);
        if (c !== 'INR') totalProfitUSD = decimal.add(totalProfitUSD, s.estimatedProfitForeign || 0);
      });
      totalSalesINR = decimal.round2(totalSalesINR);
      profitINR = decimal.round2(profitINR);
      totalProfitUSD = decimal.round2(totalProfitUSD);
      const profitByCurrencyFinal = {};
      Object.keys(profitByCurrency).forEach(c => {
        profitByCurrencyFinal[c] = {
          profitINR: decimal.round2(profitByCurrency[c].profitINR),
          profitForeign: decimal.round2(profitByCurrency[c].profitForeign)
        };
      });

      const hasOutstanding = balances.some(b => b.outstanding > 0.01);

      if (req.query.status === 'outstanding' && !hasOutstanding) continue;
      if (req.query.status === 'settled' && hasOutstanding) continue;

      let outstandingINR = 0;
      balances.forEach(b => { if (b.currency === 'INR') outstandingINR = decimal.add(outstandingINR, b.outstanding); });
      const receivedINR = Math.max(0, decimal.round2(decimal.subtract(totalSalesINR, outstandingINR)));

      rows.push({
        party: { _id: party._id, name: party.name, country: party.country, preferredCurrency: party.preferredCurrency },
        balances,
        totalSalesINR,
        totalReceivedINR: decimal.round2(receivedINR),
        outstandingINR: decimal.round2(outstandingINR),
        totalProfitINR: profitINR,
        totalProfitUSD,
        estimatedProfitINR: profitINR,
        profitByCurrency: profitByCurrencyFinal,
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
