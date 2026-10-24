const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Party = require('../models/Party');
const PaymentAllocation = require('../models/PaymentAllocation');
const AuditLog = require('../models/AuditLog');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// Helper to generate auto-incrementing invoice number
const generateInvoiceNumber = async (userId) => {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  const salesWithPrefix = await Sale.find({
    user: userId,
    invoiceNumber: new RegExp(`^${prefix}\\d+`)
  }).select('invoiceNumber');

  let maxNum = 0;
  salesWithPrefix.forEach((s) => {
    const parts = s.invoiceNumber.split('-');
    if (parts.length === 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = String(maxNum + 1).padStart(4, '0');
  return `${prefix}${nextNum}`;
};

// @desc    Get paginated sales with filters and search
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };

    if (req.query.party) {
      filter.party = req.query.party;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.currency) {
      filter.foreignCurrency = req.query.currency;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.saleDate = {};
      if (req.query.startDate) filter.saleDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.saleDate.$lte = new Date(req.query.endDate);
    }

    if (req.query.search) {
      filter.$or = [
        { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
        { productName: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .populate('party', 'name country preferredCurrency')
      .sort({ saleDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return success(res, {
      sales,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    }, 'Sales fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new sale
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res, next) => {
  try {
    const {
      party: partyId,
      invoiceNumber: customInvoice,
      saleDate,
      productName,
      productDescription,
      quantity,
      saleAmountINR,
      saleAmountForeign,
      foreignCurrency,
      estimatedProfitINR,
      estimatedProfitForeign,
      notes,
      isOpeningBalance
    } = req.body;

    if (!partyId) {
      return error(res, 'Party is required', 400);
    }

    if (!productName) {
      return error(res, 'Product name is required', 400);
    }

    if (saleAmountINR === undefined || saleAmountINR === null || saleAmountINR < 0) {
      return error(res, 'Valid saleAmountINR is required', 400);
    }

    // Validate party belongs to user
    const party = await Party.findOne({ _id: partyId, user: req.user.id });
    if (!party) {
      return error(res, 'Party not found or does not belong to you', 404);
    }

    let invoiceNumber = customInvoice ? customInvoice.trim() : null;
    if (!invoiceNumber) {
      invoiceNumber = await generateInvoiceNumber(req.user.id);
    } else {
      // Check invoice uniqueness for this user
      const exists = await Sale.findOne({ user: req.user.id, invoiceNumber });
      if (exists) {
        return error(res, `Invoice number '${invoiceNumber}' already exists`, 409);
      }
    }

    const sale = await Sale.create({
      user: req.user.id,
      party: partyId,
      invoiceNumber,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      productName: productName.trim(),
      productDescription: productDescription ? productDescription.trim() : '',
      quantity: quantity ? Number(quantity) : 1,
      saleAmountINR: decimal.round2(saleAmountINR),
      saleAmountForeign: saleAmountForeign ? decimal.round2(saleAmountForeign) : 0,
      foreignCurrency: foreignCurrency || party.preferredCurrency || 'INR',
      estimatedProfitINR: estimatedProfitINR ? decimal.round2(estimatedProfitINR) : 0,
      estimatedProfitForeign: estimatedProfitForeign ? decimal.round2(estimatedProfitForeign) : 0,
      status: 'active',
      notes,
      isOpeningBalance: Boolean(isOpeningBalance)
    });

    // Populate party info
    await sale.populate('party', 'name country preferredCurrency');

    // Create Audit Log
    await AuditLog.create({
      user: req.user.id,
      entityType: 'Sale',
      entityId: sale._id,
      action: 'create',
      after: sale.toObject(),
      ip: req.ip
    });

    return success(res, sale, 'Sale created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Get single sale with allocations and outstanding
// @route   GET /api/sales/:id
// @access  Private
const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, user: req.user.id })
      .populate('party', 'name country preferredCurrency email phone');

    if (!sale) {
      return error(res, 'Sale not found', 404);
    }

    const allocations = await PaymentAllocation.find({
      sale: sale._id,
      isReversed: false
    }).populate('payment', 'paymentDate amountReceived currency paymentMethod bankReference');

    const outstanding = await accountingService.getSaleOutstanding(sale._id);

    return success(res, {
      sale,
      allocations,
      outstanding
    }, 'Sale retrieved successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Update a sale
// @route   PUT /api/sales/:id
// @access  Private
const updateSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, user: req.user.id });
    if (!sale) {
      return error(res, 'Sale not found', 404);
    }

    if (sale.status === 'cancelled') {
      return error(res, 'Cannot edit a cancelled sale', 400);
    }

    const before = sale.toObject();

    const allowedFields = [
      'productName',
      'productDescription',
      'quantity',
      'saleAmountINR',
      'saleAmountForeign',
      'foreignCurrency',
      'estimatedProfitINR',
      'estimatedProfitForeign',
      'saleDate',
      'notes'
    ];

    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (['saleAmountINR', 'saleAmountForeign', 'estimatedProfitINR', 'estimatedProfitForeign'].includes(f)) {
          sale[f] = decimal.round2(req.body[f]);
        } else {
          sale[f] = req.body[f];
        }
      }
    });

    await sale.save();

    // Recalculate status in case sale amount changed
    await accountingService.recalculateSaleStatus(sale._id);
    await sale.populate('party', 'name country preferredCurrency');

    await AuditLog.create({
      user: req.user.id,
      entityType: 'Sale',
      entityId: sale._id,
      action: 'update',
      before,
      after: sale.toObject(),
      ip: req.ip
    });

    return success(res, sale, 'Sale updated successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel a sale and reverse associated allocations
// @route   POST /api/sales/:id/cancel
// @access  Private
const cancelSale = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const sale = await Sale.findOne({ _id: req.params.id, user: req.user.id });

    if (!sale) {
      return error(res, 'Sale not found', 404);
    }

    if (sale.status === 'cancelled') {
      return error(res, 'Sale is already cancelled', 400);
    }

    const before = sale.toObject();

    sale.status = 'cancelled';
    sale.cancelledAt = new Date();
    sale.cancelledReason = reason || 'Cancelled by user';
    await sale.save();

    // Reverse all allocations for this sale
    const allocations = await PaymentAllocation.find({
      sale: sale._id,
      isReversed: false
    });

    for (const alloc of allocations) {
      alloc.isReversed = true;
      alloc.reversedAt = new Date();
      alloc.reversalReason = `Sale ${sale.invoiceNumber} cancelled: ${reason || 'N/A'}`;
      await alloc.save();

      await AuditLog.create({
        user: req.user.id,
        entityType: 'PaymentAllocation',
        entityId: alloc._id,
        action: 'reverse',
        before: { isReversed: false },
        after: alloc.toObject(),
        ip: req.ip
      });
    }

    await AuditLog.create({
      user: req.user.id,
      entityType: 'Sale',
      entityId: sale._id,
      action: 'cancel',
      before,
      after: sale.toObject(),
      ip: req.ip
    });

    return success(res, sale, 'Sale cancelled and allocations reversed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSales,
  createSale,
  getSale,
  updateSale,
  cancelSale
};
