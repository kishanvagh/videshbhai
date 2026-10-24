const Party = require('../models/Party');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const CurrencyExchange = require('../models/CurrencyExchange');
const OpeningBalance = require('../models/OpeningBalance');
const AuditLog = require('../models/AuditLog');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// @desc    Get paginated parties with search & filters
// @route   GET /api/parties
// @access  Private
const getParties = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id, isActive: true };

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { contactPerson: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.country) {
      filter.country = req.query.country;
    }

    if (req.query.currency) {
      filter.preferredCurrency = req.query.currency;
    }

    const total = await Party.countDocuments(filter);
    const parties = await Party.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    return success(res, {
      parties,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    }, 'Parties fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new party
// @route   POST /api/parties
// @access  Private
const createParty = async (req, res, next) => {
  try {
    const {
      name,
      country,
      contactPerson,
      email,
      phone,
      address,
      preferredCurrency,
      notes
    } = req.body;

    if (!name) {
      return error(res, 'Party name is required', 400);
    }

    const existing = await Party.findOne({
      user: req.user.id,
      name: name.trim()
    });

    if (existing) {
      return error(res, `Party '${name}' already exists`, 409);
    }

    const party = await Party.create({
      user: req.user.id,
      name: name.trim(),
      country: country || 'India',
      contactPerson,
      email,
      phone,
      address,
      preferredCurrency: preferredCurrency || 'INR',
      notes
    });

    // Create Audit Log
    await AuditLog.create({
      user: req.user.id,
      entityType: 'Party',
      entityId: party._id,
      action: 'create',
      after: party.toObject(),
      ip: req.ip
    });

    return success(res, party, 'Party created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Get single party details
// @route   GET /api/parties/:id
// @access  Private
const getParty = async (req, res, next) => {
  try {
    const party = await Party.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!party) {
      return error(res, 'Party not found', 404);
    }

    const balances = await accountingService.getPartyBalances(req.user.id, party._id);

    return success(res, {
      party,
      balances
    }, 'Party retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Update a party
// @route   PUT /api/parties/:id
// @access  Private
const updateParty = async (req, res, next) => {
  try {
    const party = await Party.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!party) {
      return error(res, 'Party not found', 404);
    }

    const before = party.toObject();

    const allowedUpdates = [
      'name',
      'country',
      'contactPerson',
      'email',
      'phone',
      'address',
      'preferredCurrency',
      'notes',
      'isActive'
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        party[field] = req.body[field];
      }
    });

    await party.save();

    await AuditLog.create({
      user: req.user.id,
      entityType: 'Party',
      entityId: party._id,
      action: 'update',
      before,
      after: party.toObject(),
      ip: req.ip
    });

    return success(res, party, 'Party updated successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get chronological ledger for party
// @route   GET /api/parties/:id/ledger
// @access  Private
const getPartyLedger = async (req, res, next) => {
  try {
    const partyId = req.params.id;
    const party = await Party.findOne({ _id: partyId, user: req.user.id });
    if (!party) {
      return error(res, 'Party not found', 404);
    }

    const entries = [];

    // 1. Sales
    const sales = await Sale.find({
      user: req.user.id,
      party: partyId,
      status: { $ne: 'cancelled' }
    });

    sales.forEach(sale => {
      const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;
      const currency = isForeign ? sale.foreignCurrency : 'INR';
      const debitAmount = isForeign ? sale.saleAmountForeign : sale.saleAmountINR;

      entries.push({
        id: sale._id,
        date: sale.saleDate,
        type: 'sale',
        description: `Sale: ${sale.productName} (Qty: ${sale.quantity || 1})`,
        debit: decimal.round2(debitAmount),
        credit: 0,
        currency,
        reference: sale.invoiceNumber,
        inrAmount: sale.saleAmountINR
      });
    });

    // 2. Payments
    const payments = await Payment.find({
      user: req.user.id,
      party: partyId,
      isReversed: false
    });

    payments.forEach(payment => {
      entries.push({
        id: payment._id,
        date: payment.paymentDate,
        type: 'payment',
        description: `Payment received via ${payment.paymentMethod.replace('_', ' ')}${payment.isAdvance ? ' (Advance)' : ''}`,
        debit: 0,
        credit: decimal.round2(payment.amountReceived),
        currency: payment.currency,
        reference: payment.bankReference || '-',
        inrAmount: null
      });
    });

    // 3. Opening balances
    const openingBalances = await OpeningBalance.find({
      user: req.user.id,
      party: partyId
    });

    openingBalances.forEach(ob => {
      const isDebit = ob.balanceType === 'receivable';
      entries.push({
        id: ob._id,
        date: ob.effectiveDate,
        type: 'opening_balance',
        description: `Opening Balance (${ob.balanceType}) - ${ob.description || ''}`,
        debit: isDebit ? decimal.round2(ob.amount) : 0,
        credit: !isDebit ? decimal.round2(ob.amount) : 0,
        currency: ob.currency,
        reference: 'OB',
        inrAmount: null
      });
    });

    // 4. Currency Exchanges
    const exchanges = await CurrencyExchange.find({
      user: req.user.id,
      party: partyId,
      isReversed: false
    });

    exchanges.forEach(ex => {
      entries.push({
        id: ex._id,
        date: ex.exchangeDate,
        type: 'exchange',
        description: `Currency Exchanged: ${ex.foreignAmountExchanged} ${ex.foreignCurrency} @ rate ${ex.exchangeRate} (Net INR: ${ex.netINRReceived})`,
        debit: 0,
        credit: 0,
        currency: ex.foreignCurrency,
        reference: ex.bankReference || '-',
        inrAmount: ex.netINRReceived
      });
    });

    // Sort chronologically ascending
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance per currency
    const runningBalances = {};
    const ledger = entries.map(entry => {
      const curr = entry.currency;
      if (!runningBalances[curr]) {
        runningBalances[curr] = 0;
      }
      runningBalances[curr] = decimal.subtract(
        decimal.add(runningBalances[curr], entry.debit),
        entry.credit
      );

      return {
        ...entry,
        balance: decimal.round2(runningBalances[curr])
      };
    });

    return success(res, {
      party: {
        id: party._id,
        name: party.name,
        country: party.country,
        preferredCurrency: party.preferredCurrency
      },
      ledger,
      finalBalances: Object.keys(runningBalances).map(curr => ({
        currency: curr,
        balance: decimal.round2(runningBalances[curr])
      }))
    }, 'Party ledger generated successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get party balances for each currency
// @route   GET /api/parties/:id/balances
// @access  Private
const getPartyBalances = async (req, res, next) => {
  try {
    const party = await Party.findOne({ _id: req.params.id, user: req.user.id });
    if (!party) {
      return error(res, 'Party not found', 404);
    }

    const balances = await accountingService.getPartyBalances(req.user.id, party._id);

    return success(res, {
      party: {
        id: party._id,
        name: party.name,
        country: party.country
      },
      balances
    }, 'Party balances retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getParties,
  createParty,
  getParty,
  updateParty,
  getPartyLedger,
  getPartyBalances
};
