const OpeningBalance = require('../models/OpeningBalance');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');

const getOpeningBalances = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.party) filter.party = req.query.party;
    if (req.query.currency) filter.currency = req.query.currency;
    if (req.query.balanceType) filter.balanceType = req.query.balanceType;

    const balances = await OpeningBalance.find(filter)
      .populate('party', 'name country')
      .sort({ effectiveDate: -1 });

    return success(res, { balances });
  } catch (err) { next(err); }
};

const createOpeningBalance = async (req, res, next) => {
  try {
    const { party, currency, amount, balanceType, description, effectiveDate } = req.body;
    if (!currency || !amount || !balanceType || !effectiveDate) {
      return error(res, 'currency, amount, balanceType, and effectiveDate are required', 400);
    }

    const balance = await OpeningBalance.create({
      user: req.user.id,
      party: party || null,
      currency,
      amount: parseFloat(amount),
      balanceType,
      description,
      effectiveDate: new Date(effectiveDate),
    });
    await balance.populate('party', 'name country');
    await AuditLog.create({ user: req.user.id, entityType: 'OpeningBalance', entityId: balance._id, action: 'create', after: balance.toObject(), ip: req.ip });
    return success(res, balance, 'Opening balance created', 201);
  } catch (err) { next(err); }
};

const updateOpeningBalance = async (req, res, next) => {
  try {
    const balance = await OpeningBalance.findOne({ _id: req.params.id, user: req.user.id });
    if (!balance) return error(res, 'Opening balance not found', 404);
    const before = balance.toObject();
    ['currency', 'amount', 'balanceType', 'description', 'effectiveDate', 'party'].forEach(f => {
      if (req.body[f] !== undefined) balance[f] = req.body[f];
    });
    await balance.save();
    await AuditLog.create({ user: req.user.id, entityType: 'OpeningBalance', entityId: balance._id, action: 'update', before, after: balance.toObject(), ip: req.ip });
    return success(res, balance, 'Opening balance updated');
  } catch (err) { next(err); }
};

const deleteOpeningBalance = async (req, res, next) => {
  try {
    const balance = await OpeningBalance.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!balance) return error(res, 'Opening balance not found', 404);
    return success(res, {}, 'Opening balance deleted');
  } catch (err) { next(err); }
};

module.exports = { getOpeningBalances, createOpeningBalance, updateOpeningBalance, deleteOpeningBalance };
