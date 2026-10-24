const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Party = require('../models/Party');
const PaymentAllocation = require('../models/PaymentAllocation');
const AuditLog = require('../models/AuditLog');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// @desc    Get paginated payments with filters
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };

    if (req.query.party) {
      filter.party = req.query.party;
    }

    if (req.query.currency) {
      filter.currency = req.query.currency;
    }

    if (req.query.method) {
      filter.paymentMethod = req.query.method;
    }

    if (req.query.isAdvance !== undefined) {
      filter.isAdvance = req.query.isAdvance === 'true';
    }

    if (req.query.isReversed !== undefined) {
      filter.isReversed = req.query.isReversed === 'true';
    }

    if (req.query.startDate || req.query.endDate) {
      filter.paymentDate = {};
      if (req.query.startDate) filter.paymentDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.paymentDate.$lte = new Date(req.query.endDate);
    }

    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('party', 'name country preferredCurrency')
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Attach allocation stats to each payment
    const paymentIds = payments.map(p => p._id);
    const allocations = await PaymentAllocation.find({
      payment: { $in: paymentIds },
      isReversed: false
    });

    const paymentsWithStats = payments.map(p => {
      const pAllocations = allocations.filter(a => a.payment.toString() === p._id.toString());
      const totalAllocated = pAllocations.reduce((sum, a) => decimal.add(sum, a.allocatedAmount), 0);
      const unallocated = Math.max(0, decimal.subtract(p.amountReceived, totalAllocated));
      return {
        ...p.toObject(),
        totalAllocated: decimal.round2(totalAllocated),
        unallocatedAmount: decimal.round2(unallocated)
      };
    });

    return success(res, {
      payments: paymentsWithStats,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    }, 'Payments fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new payment with optional immediate allocations
// @route   POST /api/payments
// @access  Private
const createPayment = async (req, res, next) => {
  try {
    const {
      party: partyId,
      paymentDate,
      amountReceived,
      currency,
      paymentMethod,
      bankReference,
      referenceNumber,
      notes,
      isAdvance,
      allocations
    } = req.body;

    if (!partyId) {
      return error(res, 'Party is required', 400);
    }

    const numericAmount = parseFloat(amountReceived);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return error(res, 'Amount received must be a positive number', 400);
    }

    const party = await Party.findOne({ _id: partyId, user: req.user.id });
    if (!party) {
      return error(res, 'Party not found or does not belong to you', 404);
    }

    const paymentCurrency = currency || party.preferredCurrency || 'INR';

    // Validate allocations array if provided
    let totalAllocatedToApply = 0;
    let effectiveAllocations = (allocations && Array.isArray(allocations)) ? allocations : [];

    // AUTO-ALLOCATE: when no invoice allocations were specified, apply the payment
    // to the party's oldest outstanding invoices in the same currency. This makes
    // "Received" go up and "Due / Outstanding" go down automatically whenever a
    // payment is recorded against a party.
    if (effectiveAllocations.length === 0 && !Boolean(isAdvance)) {
      effectiveAllocations = await accountingService.computeAutoPaymentAllocation(
        req.user.id,
        partyId,
        numericAmount,
        paymentCurrency
      );
    }

    if (effectiveAllocations && effectiveAllocations.length > 0) {
      for (const item of effectiveAllocations) {
        const itemAmount = parseFloat(item.allocatedAmount ?? item.amountAllocated);
        if (isNaN(itemAmount) || itemAmount <= 0) {
          return error(res, 'Each allocation amount must be greater than zero', 400);
        }
        totalAllocatedToApply = decimal.add(totalAllocatedToApply, itemAmount);

        // Check sale existence and outstanding balance
        const sale = await Sale.findOne({ _id: item.sale, user: req.user.id });
        if (!sale) {
          return error(res, `Sale ${item.sale} not found`, 404);
        }
        if (sale.status === 'cancelled') {
          return error(res, `Cannot allocate payment to cancelled sale ${sale.invoiceNumber}`, 400);
        }

        const outstanding = await accountingService.getSaleOutstanding(sale._id);
        const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;
        const availableOutstanding = isForeign ? outstanding.outstandingForeign : outstanding.outstandingINR;

        let settledAmount = itemAmount;
        if (item.isCrossCurrency && item.settlementAmountInSaleCurrency) {
          settledAmount = parseFloat(item.settlementAmountInSaleCurrency);
        }

        if (settledAmount > availableOutstanding + 0.01) {
          return error(res, `Allocation of ${settledAmount} exceeds outstanding balance ${availableOutstanding} for invoice ${sale.invoiceNumber}`, 400);
        }
      }

      if (totalAllocatedToApply > numericAmount + 0.01) {
        return error(res, `Total allocations (${totalAllocatedToApply}) cannot exceed payment amount (${numericAmount})`, 400);
      }
    }

    // Determine if advance
    const effectiveIsAdvance = Boolean(isAdvance) || (effectiveAllocations.length === 0);

    // Create payment
    const payment = await Payment.create({
      user: req.user.id,
      party: partyId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amountReceived: decimal.round2(numericAmount),
      currency: paymentCurrency,
      paymentMethod: paymentMethod || 'bank_transfer',
      bankReference: bankReference || referenceNumber || '',
      notes,
      isAdvance: effectiveIsAdvance
    });

    const createdAllocations = [];

    // Create allocations if specified
    if (effectiveAllocations && effectiveAllocations.length > 0) {
      for (const item of effectiveAllocations) {
        const alloc = await PaymentAllocation.create({
          user: req.user.id,
          payment: payment._id,
          sale: item.sale,
          allocatedAmount: decimal.round2(item.allocatedAmount ?? item.amountAllocated),
          currency: paymentCurrency,
          allocationDate: payment.paymentDate,
          isCrossCurrency: Boolean(item.isCrossCurrency),
          exchangeRateUsed: item.exchangeRateUsed ? Number(item.exchangeRateUsed) : null,
          settlementAmountInSaleCurrency: item.settlementAmountInSaleCurrency ? decimal.round2(item.settlementAmountInSaleCurrency) : null,
          notes: item.notes
        });

        // Recalculate sale status
        await accountingService.recalculateSaleStatus(item.sale);
        createdAllocations.push(alloc);

        await AuditLog.create({
          user: req.user.id,
          entityType: 'PaymentAllocation',
          entityId: alloc._id,
          action: 'allocate',
          after: alloc.toObject(),
          ip: req.ip
        });
      }
    }

    await AuditLog.create({
      user: req.user.id,
      entityType: 'Payment',
      entityId: payment._id,
      action: 'create',
      after: payment.toObject(),
      ip: req.ip
    });

    await payment.populate('party', 'name country preferredCurrency');

    return success(res, {
      payment,
      allocations: createdAllocations
    }, 'Payment created successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Get single payment with allocations
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user.id })
      .populate('party', 'name country preferredCurrency');

    if (!payment) {
      return error(res, 'Payment not found', 404);
    }

    const allocations = await PaymentAllocation.find({
      payment: payment._id,
      isReversed: false
    }).populate('sale', 'invoiceNumber productName saleDate saleAmountINR saleAmountForeign foreignCurrency status');

    const totalAllocated = allocations.reduce((sum, a) => decimal.add(sum, a.allocatedAmount), 0);
    const unallocated = Math.max(0, decimal.subtract(payment.amountReceived, totalAllocated));

    return success(res, {
      payment,
      allocations,
      totalAllocated: decimal.round2(totalAllocated),
      unallocatedAmount: decimal.round2(unallocated)
    }, 'Payment details fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Reverse payment and its allocations
// @route   POST /api/payments/:id/reverse
// @access  Private
const reversePayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user.id });

    if (!payment) {
      return error(res, 'Payment not found', 404);
    }

    if (payment.isReversed) {
      return error(res, 'Payment is already reversed', 400);
    }

    const before = payment.toObject();

    payment.isReversed = true;
    payment.reversedAt = new Date();
    payment.reversalReason = reason || 'Reversed by user';
    await payment.save();

    // Reverse all allocations for this payment
    const allocations = await PaymentAllocation.find({
      payment: payment._id,
      isReversed: false
    });

    for (const alloc of allocations) {
      alloc.isReversed = true;
      alloc.reversedAt = new Date();
      alloc.reversalReason = `Payment reversal: ${reason || 'N/A'}`;
      await alloc.save();

      // Recalculate affected sale status
      await accountingService.recalculateSaleStatus(alloc.sale);

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
      entityType: 'Payment',
      entityId: payment._id,
      action: 'reverse',
      before,
      after: payment.toObject(),
      ip: req.ip
    });

    return success(res, payment, 'Payment reversed and affected sales recalculated successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Get unsettled sales for a party with outstanding amounts
// @route   GET /api/payments/outstanding/:partyId
// @access  Private
const getOutstandingByParty = async (req, res, next) => {
  try {
    const partyId = req.params.partyId;
    const party = await Party.findOne({ _id: partyId, user: req.user.id });
    if (!party) {
      return error(res, 'Party not found', 404);
    }

    const unsettledSales = await Sale.find({
      user: req.user.id,
      party: partyId,
      status: { $in: ['active', 'partial'] }
    }).sort({ saleDate: 1 });

    const results = [];
    for (const sale of unsettledSales) {
      const outstanding = await accountingService.getSaleOutstanding(sale._id);
      results.push({
        sale: {
          id: sale._id,
          invoiceNumber: sale.invoiceNumber,
          saleDate: sale.saleDate,
          productName: sale.productName,
          status: sale.status,
          foreignCurrency: sale.foreignCurrency,
          saleAmountINR: sale.saleAmountINR,
          saleAmountForeign: sale.saleAmountForeign
        },
        outstanding
      });
    }

    return success(res, results, 'Unsettled sales retrieved successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPayments,
  createPayment,
  getPayment,
  reversePayment,
  getOutstandingByParty
};
