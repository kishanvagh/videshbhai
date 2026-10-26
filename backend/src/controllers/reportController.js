const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const CurrencyExchange = require('../models/CurrencyExchange');
const Party = require('../models/Party');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');
const mongoose = require('mongoose');

const buildDateFilter = (field, startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const f = {};
  if (startDate) f.$gte = new Date(startDate);
  if (endDate) f.$lte = new Date(endDate);
  return { [field]: f };
};

// @desc    Sales report
// @route   GET /api/reports/sales
const getSalesReport = async (req, res, next) => {
  try {
    const filter = { user: req.user.id, status: { $ne: 'cancelled' } };
    Object.assign(filter, buildDateFilter('saleDate', req.query.startDate, req.query.endDate));
    if (req.query.party) filter.party = req.query.party;
    if (req.query.currency) filter.foreignCurrency = req.query.currency;

    const sales = await Sale.find(filter)
      .populate('party', 'name country')
      .sort({ saleDate: -1 });

    const totalINR = sales.reduce((s, x) => decimal.add(s, x.saleAmountINR), 0);
    const totalProfitINR = sales.reduce((s, x) => decimal.add(s, x.estimatedProfitINR || 0), 0);
    const totalForeign = sales.reduce((s, x) => decimal.add(s, x.saleAmountForeign || 0), 0);
    const totalProfitForeign = sales.reduce((s, x) => decimal.add(s, x.estimatedProfitForeign || 0), 0);

    return success(res, {
      sales,
      summary: {
        totalINR: decimal.round2(totalINR),
        totalProfitINR: decimal.round2(totalProfitINR),
        totalForeign: decimal.round2(totalForeign),
        totalProfitForeign: decimal.round2(totalProfitForeign),
        count: sales.length
      }
    });
  } catch (err) { next(err); }
};

// @desc    Payments report
// @route   GET /api/reports/payments
const getPaymentsReport = async (req, res, next) => {
  try {
    const filter = { user: req.user.id, isReversed: false };
    Object.assign(filter, buildDateFilter('paymentDate', req.query.startDate, req.query.endDate));
    if (req.query.party) filter.party = req.query.party;
    if (req.query.currency) filter.currency = req.query.currency;

    const payments = await Payment.find(filter)
      .populate('party', 'name country')
      .sort({ paymentDate: -1 });

    // Group by currency
    const byCurrency = {};
    payments.forEach(p => {
      if (!byCurrency[p.currency]) byCurrency[p.currency] = 0;
      byCurrency[p.currency] = decimal.round2(decimal.add(byCurrency[p.currency], p.amountReceived));
    });

    return success(res, { payments, summary: { byCurrency, count: payments.length } });
  } catch (err) { next(err); }
};

// @desc    Outstanding invoices report
// @route   GET /api/reports/outstanding
const getOutstandingReport = async (req, res, next) => {
  try {
    const filter = { user: req.user.id, status: { $in: ['active', 'partial'] } };
    if (req.query.party) filter.party = req.query.party;
    if (req.query.currency) filter.foreignCurrency = req.query.currency;

    const sales = await Sale.find(filter)
      .populate('party', 'name country')
      .sort({ saleDate: 1 });

    const result = [];
    for (const sale of sales) {
      const outstanding = await accountingService.getSaleOutstanding(sale._id);
      // Only include invoices with an outstanding foreign-currency balance.
      // INR-only outstanding is excluded per business requirement.
      if (outstanding.outstandingForeign > 0.01) {
        result.push({ sale, outstanding });
      }
    }

    return success(res, { invoices: result, count: result.length });
  } catch (err) { next(err); }
};

// @desc    Profit report
// @route   GET /api/reports/profit
const getProfitReport = async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const matchFilter = { user: userObjectId, status: { $ne: 'cancelled' } };
    if (req.query.startDate || req.query.endDate) {
      matchFilter.saleDate = {};
      if (req.query.startDate) matchFilter.saleDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) matchFilter.saleDate.$lte = new Date(req.query.endDate);
    }
    // Apply party filter if provided
    if (req.query.party) {
      matchFilter.party = new mongoose.Types.ObjectId(req.query.party);
    }

    const profitByParty = await Sale.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$party',
          totalSalesINR: { $sum: '$saleAmountINR' },
          totalProfitINR: { $sum: '$estimatedProfitINR' },
          totalSalesForeign: { $sum: '$saleAmountForeign' },
          totalProfitForeign: { $sum: '$estimatedProfitForeign' },
          count: { $sum: 1 }
        }
      },
      { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'party' } },
      // FIX: correct option is preserveNullAndEmptyArrays (was preserveNullAndEmpty which is invalid
      // and caused $unwind to silently drop all documents)
      { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
      { $sort: { totalProfitForeign: -1 } }
    ]);

    const totalProfitINR = profitByParty.reduce((s, x) => decimal.add(s, x.totalProfitINR || 0), 0);
    const totalProfitUSD = profitByParty.reduce((s, x) => decimal.add(s, x.totalProfitForeign || 0), 0);
    const totalSalesINR = profitByParty.reduce((s, x) => decimal.add(s, x.totalSalesINR || 0), 0);
    const totalSalesForeign = profitByParty.reduce((s, x) => decimal.add(s, x.totalSalesForeign || 0), 0);
    return success(res, {
      profitByParty,
      totalProfitINR: decimal.round2(totalProfitINR),
      totalProfitUSD: decimal.round2(totalProfitUSD),
      totalSalesINR: decimal.round2(totalSalesINR),
      totalSalesForeign: decimal.round2(totalSalesForeign)
    });
  } catch (err) { next(err); }
};

// @desc    Currency exchange report
// @route   GET /api/reports/currency-exchange
const getExchangeReport = async (req, res, next) => {
  try {
    const filter = { user: req.user.id, isReversed: false };
    Object.assign(filter, buildDateFilter('exchangeDate', req.query.startDate, req.query.endDate));
    if (req.query.currency) filter.foreignCurrency = req.query.currency;
    if (req.query.party) filter.party = req.query.party;

    const exchanges = await CurrencyExchange.find(filter)
      .populate('party', 'name country')
      .sort({ exchangeDate: -1 });

    const totalNetINR = exchanges.reduce((s, x) => decimal.add(s, x.netINRReceived), 0);
    const byCurrency = {};
    exchanges.forEach(e => {
      if (!byCurrency[e.foreignCurrency]) byCurrency[e.foreignCurrency] = { totalExchanged: 0, totalNetINR: 0 };
      byCurrency[e.foreignCurrency].totalExchanged = decimal.round2(decimal.add(byCurrency[e.foreignCurrency].totalExchanged, e.foreignAmountExchanged));
      byCurrency[e.foreignCurrency].totalNetINR = decimal.round2(decimal.add(byCurrency[e.foreignCurrency].totalNetINR, e.netINRReceived));
    });

    return success(res, { exchanges, summary: { totalNetINR: decimal.round2(totalNetINR), byCurrency, count: exchanges.length } });
  } catch (err) { next(err); }
};

// @desc    Party account statement
// @route   GET /api/reports/party-statement/:id
const getPartyStatement = async (req, res, next) => {
  try {
    const partyId = req.params.id;
    const party = await Party.findOne({ _id: partyId, user: req.user.id });
    if (!party) return error(res, 'Party not found', 404);

    const dateFilter = buildDateFilter;
    const saleFilter = { user: req.user.id, party: partyId };
    const payFilter = { user: req.user.id, party: partyId };
    if (req.query.startDate || req.query.endDate) {
      Object.assign(saleFilter, buildDateFilter('saleDate', req.query.startDate, req.query.endDate));
      Object.assign(payFilter, buildDateFilter('paymentDate', req.query.startDate, req.query.endDate));
    }

    const sales = await Sale.find(saleFilter).sort({ saleDate: 1 });
    const payments = await Payment.find({ ...payFilter, isReversed: false }).sort({ paymentDate: 1 });
    const balances = await accountingService.getPartyBalances(req.user.id, partyId);

    // Build chronological ledger
    const ledger = [];
    sales.forEach(s => {
      const isForeign = s.foreignCurrency && s.foreignCurrency !== 'INR' && s.saleAmountForeign > 0;
      ledger.push({
        date: s.saleDate,
        type: 'Sale',
        description: `Sale: ${s.productName} (${s.invoiceNumber})`,
        debit: isForeign ? s.saleAmountForeign : s.saleAmountINR,
        credit: 0,
        currency: isForeign ? s.foreignCurrency : 'INR',
        debitINR: s.saleAmountINR,
        reference: s.invoiceNumber,
        status: s.status,
      });
    });
    payments.forEach(p => {
      ledger.push({
        date: p.paymentDate,
        type: 'Payment',
        description: `Payment received${p.paymentMethod ? ' via ' + p.paymentMethod : ''}${p.bankReference ? ' (' + p.bankReference + ')' : ''}`,
        debit: 0,
        credit: p.amountReceived,
        currency: p.currency,
        reference: p.bankReference || '',
        isAdvance: p.isAdvance,
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    return success(res, { party, ledger, balances });
  } catch (err) { next(err); }
};

// @desc    Export as CSV
// @route   GET /api/reports/export/csv
const exportCSV = async (req, res, next) => {
  try {
    const type = req.query.type || 'sales';
    let rows = [];
    let headers = [];

    if (type === 'sales') {
      const filter = { user: req.user.id, status: { $ne: 'cancelled' } };
      if (req.query.startDate || req.query.endDate) Object.assign(filter, buildDateFilter('saleDate', req.query.startDate, req.query.endDate));
      const sales = await Sale.find(filter).populate('party', 'name country').sort({ saleDate: -1 });
      headers = ['Invoice#', 'Date', 'Party', 'Country', 'Product', 'Sale INR', 'Sale Foreign', 'Currency', 'Profit INR', 'Status'];
      rows = sales.map(s => [
        s.invoiceNumber, s.saleDate.toISOString().split('T')[0],
        s.party?.name, s.party?.country, s.productName,
        s.saleAmountINR, s.saleAmountForeign, s.foreignCurrency,
        s.estimatedProfitINR, s.status
      ]);
    } else if (type === 'payments') {
      const filter = { user: req.user.id, isReversed: false };
      if (req.query.startDate || req.query.endDate) Object.assign(filter, buildDateFilter('paymentDate', req.query.startDate, req.query.endDate));
      const payments = await Payment.find(filter).populate('party', 'name country').sort({ paymentDate: -1 });
      headers = ['Date', 'Party', 'Country', 'Amount', 'Currency', 'Method', 'Reference', 'Is Advance'];
      rows = payments.map(p => [
        p.paymentDate.toISOString().split('T')[0],
        p.party?.name, p.party?.country,
        p.amountReceived, p.currency, p.paymentMethod, p.bankReference || '', p.isAdvance ? 'Yes' : 'No'
      ]);
    } else if (type === 'outstanding') {
      const filter = { user: req.user.id, status: { $in: ['active', 'partial'] } };
      const sales = await Sale.find(filter).populate('party', 'name country');
      headers = ['Invoice#', 'Date', 'Party', 'Country', 'Product', 'Sale INR', 'Sale Foreign', 'Currency', 'Outstanding INR', 'Outstanding Foreign', 'Status'];
      for (const s of sales) {
        const out = await accountingService.getSaleOutstanding(s._id);
        rows.push([
          s.invoiceNumber, s.saleDate.toISOString().split('T')[0],
          s.party?.name, s.party?.country, s.productName,
          s.saleAmountINR, s.saleAmountForeign, s.foreignCurrency,
          out.outstandingINR, out.outstandingForeign, s.status
        ]);
      }
    }

    // Build CSV
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v ?? ''}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};

// @desc    Monthly trend data
// @route   GET /api/reports/monthly-trend
const getMonthlyTrend = async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months, 10) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const salesTrend = await Sale.aggregate([
      { $match: { user: userObjectId, status: { $ne: 'cancelled' }, saleDate: { $gte: startDate } } },
      { $group: { _id: { year: { $year: '$saleDate' }, month: { $month: '$saleDate' } }, totalINR: { $sum: '$saleAmountINR' }, totalForeign: { $sum: '$saleAmountForeign' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const paymentsTrend = await Payment.aggregate([
      { $match: { user: userObjectId, isReversed: false, paymentDate: { $gte: startDate } } },
      { $group: { _id: { year: { $year: '$paymentDate' }, month: { $month: '$paymentDate' }, currency: '$currency' }, total: { $sum: '$amountReceived' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    return success(res, { salesTrend, paymentsTrend });
  } catch (err) { next(err); }
};

module.exports = { getSalesReport, getPaymentsReport, getOutstandingReport, getProfitReport, getExchangeReport, getPartyStatement, exportCSV, getMonthlyTrend };
