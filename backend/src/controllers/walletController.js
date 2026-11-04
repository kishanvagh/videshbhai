const WalletAdjustment = require('../models/WalletAdjustment');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// @desc    List wallet adjustments (optionally filtered by currency)
// @route   GET /api/wallet/adjustments
const getAdjustments = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.currency) filter.currency = req.query.currency.toUpperCase();
    const adjustments = await WalletAdjustment.find(filter)
      .sort({ adjustmentDate: -1, createdAt: -1 });
    return success(res, { adjustments }, 'Wallet adjustments fetched successfully');
  } catch (err) { next(err); }
};

// @desc    Add a wallet adjustment (manual edit of a currency holding)
// @route   POST /api/wallet/adjustments
const createAdjustment = async (req, res, next) => {
  try {
    const { currency, amount, reason, referenceNumber, adjustmentDate } = req.body;
    if (!currency) return error(res, 'Currency is required', 400);
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount === 0) {
      return error(res, 'Adjustment amount must be a non-zero number', 400);
    }

    const adjustment = await WalletAdjustment.create({
      user: req.user.id,
      currency: String(currency).toUpperCase(),
      amount: decimal.round2(numericAmount),
      reason,
      referenceNumber,
      adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : new Date()
    });

    await AuditLog.create({
      user: req.user.id,
      entityType: 'WalletAdjustment',
      entityId: adjustment._id,
      action: 'create',
      after: adjustment.toObject(),
      ip: req.ip
    });

    return success(res, adjustment, 'Wallet adjusted successfully', 201);
  } catch (err) { next(err); }
};

// @desc    Delete a wallet adjustment
// @route   DELETE /api/wallet/adjustments/:id
const deleteAdjustment = async (req, res, next) => {
  try {
    const adjustment = await WalletAdjustment.findOne({ _id: req.params.id, user: req.user.id });
    if (!adjustment) return error(res, 'Adjustment not found', 404);
    await WalletAdjustment.deleteOne({ _id: adjustment._id });
    await AuditLog.create({
      user: req.user.id,
      entityType: 'WalletAdjustment',
      entityId: adjustment._id,
      action: 'delete',
      before: adjustment.toObject(),
      ip: req.ip
    });
    return success(res, null, 'Wallet adjustment deleted successfully');
  } catch (err) { next(err); }
};


// @desc    Update a wallet adjustment
// @route   PUT /api/wallet/adjustments/:id
const updateAdjustment = async (req, res, next) => {
  try {
    const adjustment = await WalletAdjustment.findOne({ _id: req.params.id, user: req.user.id });
    if (!adjustment) return error(res, 'Adjustment not found', 404);

    const before = adjustment.toObject();
    const { amount, reason, referenceNumber, adjustmentDate } = req.body;
    if (amount !== undefined) {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount === 0) {
        return error(res, 'Adjustment amount must be a non-zero number', 400);
      }
      adjustment.amount = decimal.round2(numericAmount);
    }
    if (reason !== undefined) adjustment.reason = reason;
    if (referenceNumber !== undefined) adjustment.referenceNumber = referenceNumber;
    if (adjustmentDate !== undefined) adjustment.adjustmentDate = new Date(adjustmentDate);

    await adjustment.save();

    await AuditLog.create({
      user: req.user.id,
      entityType: 'WalletAdjustment',
      entityId: adjustment._id,
      action: 'update',
      before,
      after: adjustment.toObject(),
      ip: req.ip
    });

    return success(res, adjustment, 'Wallet adjustment updated successfully');
  } catch (err) { next(err); }
};
module.exports = { getAdjustments, createAdjustment, updateAdjustment, deleteAdjustment };