const mongoose = require('mongoose');
const CurrencyExchange = require('../models/CurrencyExchange');
const AuditLog = require('../models/AuditLog');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// @desc    Get all currency exchanges
// @route   GET /api/exchanges
const getExchanges = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (req.query.currency) filter.foreignCurrency = req.query.currency;
    if (req.query.party) filter.party = req.query.party;
    if (req.query.isReversed !== undefined) filter.isReversed = req.query.isReversed === 'true';
    if (req.query.startDate || req.query.endDate) {
      filter.exchangeDate = {};
      if (req.query.startDate) filter.exchangeDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.exchangeDate.$lte = new Date(req.query.endDate);
    }

    const total = await CurrencyExchange.countDocuments(filter);
    const exchanges = await CurrencyExchange.find(filter)
      .populate('party', 'name country')
      .sort({ exchangeDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return success(res, {
      exchanges,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get currency balance positions
// @route   GET /api/exchanges/currency-balances
const getCurrencyBalances = async (req, res, next) => {
  try {
    const holdings = await accountingService.getCurrencyHoldings(req.user.id);
    return success(res, { holdings });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a currency exchange record
// @route   POST /api/exchanges
const createExchange = async (req, res, next) => {
  try {
    const {
      party,
      exchangeDate,
      foreignCurrency,
      foreignAmountExchanged,
      exchangeRate,
      exchangeFee,
      netINRReceived,
      bankReference,
      notes,
      source,
    } = req.body;

    if (!foreignCurrency || !foreignAmountExchanged || !exchangeRate) {
      return error(res, 'foreignCurrency, foreignAmountExchanged, and exchangeRate are required', 400);
    }

    const fxAmount = decimal.round2(parseFloat(foreignAmountExchanged));
    const rate = parseFloat(exchangeRate);
    const fee = exchangeFee ? decimal.round2(parseFloat(exchangeFee)) : 0;
    const grossINR = decimal.round2(decimal.multiply(fxAmount, rate));
    const netINR = netINRReceived != null
      ? decimal.round2(parseFloat(netINRReceived))
      : decimal.round2(decimal.subtract(grossINR, fee));

    // Validate: don't let exchange exceed available holding
    if (source !== 'external' && source !== 'opening_balance') {
      const holding = await accountingService.getCurrencyHoldings(req.user.id, foreignCurrency);
      if (holding && holding.currentHolding < fxAmount - 0.001) {
        return error(
          res,
          `Insufficient ${foreignCurrency} balance. Available: ${holding.currentHolding}, Requested: ${fxAmount}`,
          400
        );
      }
    }

    const exchange = await CurrencyExchange.create({
      user: req.user.id,
      party: party || null,
      exchangeDate: exchangeDate ? new Date(exchangeDate) : new Date(),
      foreignCurrency,
      foreignAmountExchanged: fxAmount,
      exchangeRate: rate,
      grossINRAmount: grossINR,
      exchangeFee: fee,
      netINRReceived: netINR,
      bankReference,
      notes,
      source: source || 'payment',
    });

    await exchange.populate('party', 'name country');

    await AuditLog.create({
      user: req.user.id,
      entityType: 'CurrencyExchange',
      entityId: exchange._id,
      action: 'create',
      after: exchange.toObject(),
      ip: req.ip,
    });

    return success(res, exchange, 'Currency exchange recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Update a currency exchange
// @route   PUT /api/exchanges/:id
const updateExchange = async (req, res, next) => {
  try {
    const exchange = await CurrencyExchange.findOne({ _id: req.params.id, user: req.user.id });
    if (!exchange) return error(res, 'Exchange not found', 404);
    if (exchange.isReversed) return error(res, 'Cannot edit a reversed exchange', 400);

    const before = exchange.toObject();
    const allowed = ['exchangeDate', 'exchangeRate', 'exchangeFee', 'netINRReceived', 'bankReference', 'notes', 'party'];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) exchange[f] = req.body[f];
    });

    // Recalculate gross
    if (req.body.foreignAmountExchanged) exchange.foreignAmountExchanged = decimal.round2(parseFloat(req.body.foreignAmountExchanged));
    exchange.grossINRAmount = decimal.round2(decimal.multiply(exchange.foreignAmountExchanged, exchange.exchangeRate));
    if (!req.body.netINRReceived) {
      exchange.netINRReceived = decimal.round2(decimal.subtract(exchange.grossINRAmount, exchange.exchangeFee));
    }

    await exchange.save();
    await AuditLog.create({ user: req.user.id, entityType: 'CurrencyExchange', entityId: exchange._id, action: 'update', before, after: exchange.toObject(), ip: req.ip });
    return success(res, exchange, 'Exchange updated successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Reverse a currency exchange
// @route   POST /api/exchanges/:id/reverse
const reverseExchange = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const exchange = await CurrencyExchange.findOne({ _id: req.params.id, user: req.user.id });
    if (!exchange) return error(res, 'Exchange not found', 404);
    if (exchange.isReversed) return error(res, 'Exchange is already reversed', 400);

    const before = exchange.toObject();
    exchange.isReversed = true;
    exchange.reversedAt = new Date();
    exchange.reversalReason = reason || 'Reversed by user';
    await exchange.save();

    await AuditLog.create({ user: req.user.id, entityType: 'CurrencyExchange', entityId: exchange._id, action: 'reverse', before, after: exchange.toObject(), ip: req.ip });
    return success(res, exchange, 'Exchange reversed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getExchanges, getCurrencyBalances, createExchange, updateExchange, reverseExchange };
