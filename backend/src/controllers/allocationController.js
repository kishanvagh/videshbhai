const PaymentAllocation = require('../models/PaymentAllocation');
const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const AuditLog = require('../models/AuditLog');
const accountingService = require('../services/accountingService');
const { success, error } = require('../utils/apiResponse');
const decimal = require('../utils/decimal');

// @desc    Get allocations filtered by payment or sale
// @route   GET /api/allocations
// @access  Private
const getAllocations = async (req, res, next) => {
  try {
    const filter = { user: req.user.id };

    if (req.query.paymentId) {
      filter.payment = req.query.paymentId;
    }

    if (req.query.saleId) {
      filter.sale = req.query.saleId;
    }

    if (req.query.isReversed !== undefined) {
      filter.isReversed = req.query.isReversed === 'true';
    }

    const allocations = await PaymentAllocation.find(filter)
      .populate('payment', 'paymentDate amountReceived currency paymentMethod bankReference')
      .populate('sale', 'invoiceNumber productName saleDate saleAmountINR saleAmountForeign foreignCurrency status')
      .sort({ allocationDate: -1, createdAt: -1 });

    return success(res, allocations, 'Allocations fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Create a payment allocation to a sale
// @route   POST /api/allocations
// @access  Private
const createAllocation = async (req, res, next) => {
  try {
    const {
      payment: paymentId,
      sale: saleId,
      allocatedAmount,
      isCrossCurrency,
      exchangeRateUsed,
      settlementAmountInSaleCurrency,
      notes
    } = req.body;

    if (!paymentId || !saleId) {
      return error(res, 'Both payment and sale are required', 400);
    }

    const numericAmount = parseFloat(allocatedAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return error(res, 'Allocated amount must be a positive number', 400);
    }

    // 1. Validate Payment
    const payment = await Payment.findOne({ _id: paymentId, user: req.user.id });
    if (!payment) {
      return error(res, 'Payment not found', 404);
    }
    if (payment.isReversed) {
      return error(res, 'Cannot allocate from a reversed payment', 400);
    }

    // Calculate unallocated payment balance
    const existingAllocations = await PaymentAllocation.find({
      payment: payment._id,
      isReversed: false
    });
    const currentAllocated = existingAllocations.reduce((sum, a) => decimal.add(sum, a.allocatedAmount), 0);
    const unallocated = decimal.subtract(payment.amountReceived, currentAllocated);

    if (numericAmount > unallocated + 0.01) {
      return error(res, `Allocated amount (${numericAmount}) exceeds unallocated payment balance (${decimal.round2(unallocated)})`, 400);
    }

    // 2. Validate Sale
    const sale = await Sale.findOne({ _id: saleId, user: req.user.id });
    if (!sale) {
      return error(res, 'Sale not found', 404);
    }
    if (sale.status === 'cancelled') {
      return error(res, 'Cannot allocate payment to a cancelled sale', 400);
    }

    const outstanding = await accountingService.getSaleOutstanding(sale._id);
    const isForeign = sale.foreignCurrency && sale.foreignCurrency !== 'INR' && sale.saleAmountForeign > 0;
    const salePrimaryCurrency = isForeign ? sale.foreignCurrency : 'INR';
    const isCross = Boolean(isCrossCurrency) || (payment.currency !== salePrimaryCurrency);

    let effectiveSettlementAmount = numericAmount;
    let rate = null;

    if (isCross) {
      if (!exchangeRateUsed && !settlementAmountInSaleCurrency) {
        return error(res, 'Cross-currency allocation requires exchangeRateUsed or settlementAmountInSaleCurrency', 400);
      }

      rate = exchangeRateUsed ? parseFloat(exchangeRateUsed) : null;
      if (settlementAmountInSaleCurrency) {
        effectiveSettlementAmount = parseFloat(settlementAmountInSaleCurrency);
      } else if (rate) {
        // If payment is foreign currency and sale is INR: settlement = amount * rate
        // If payment is INR and sale is foreign: settlement = amount / rate
        if (payment.currency !== 'INR' && salePrimaryCurrency === 'INR') {
          effectiveSettlementAmount = decimal.multiply(numericAmount, rate);
        } else if (payment.currency === 'INR' && salePrimaryCurrency !== 'INR') {
          effectiveSettlementAmount = decimal.divide(numericAmount, rate);
        } else {
          effectiveSettlementAmount = decimal.multiply(numericAmount, rate);
        }
      }
    }

    const maxOutstanding = isForeign ? outstanding.outstandingForeign : outstanding.outstandingINR;
    if (effectiveSettlementAmount > maxOutstanding + 0.01) {
      return error(res, `Settlement amount (${decimal.round2(effectiveSettlementAmount)} ${salePrimaryCurrency}) exceeds sale outstanding balance (${maxOutstanding} ${salePrimaryCurrency})`, 400);
    }

    // 3. Create allocation
    const allocation = await PaymentAllocation.create({
      user: req.user.id,
      payment: payment._id,
      sale: sale._id,
      allocatedAmount: decimal.round2(numericAmount),
      currency: payment.currency,
      allocationDate: new Date(),
      isCrossCurrency: isCross,
      exchangeRateUsed: rate,
      settlementAmountInSaleCurrency: decimal.round2(effectiveSettlementAmount),
      notes
    });

    // 4. Recalculate sale status
    const newStatus = await accountingService.recalculateSaleStatus(sale._id);

    // 5. Audit log
    await AuditLog.create({
      user: req.user.id,
      entityType: 'PaymentAllocation',
      entityId: allocation._id,
      action: 'allocate',
      after: allocation.toObject(),
      ip: req.ip
    });

    await allocation.populate('payment', 'paymentDate amountReceived currency paymentMethod bankReference');
    await allocation.populate('sale', 'invoiceNumber productName saleDate saleAmountINR saleAmountForeign foreignCurrency status');

    return success(res, {
      allocation,
      saleStatus: newStatus
    }, 'Payment allocated successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Reverse an allocation
// @route   POST /api/allocations/:id/reverse
// @access  Private
const reverseAllocation = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const allocation = await PaymentAllocation.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!allocation) {
      return error(res, 'Allocation not found', 404);
    }

    if (allocation.isReversed) {
      return error(res, 'Allocation is already reversed', 400);
    }

    const before = allocation.toObject();

    allocation.isReversed = true;
    allocation.reversedAt = new Date();
    allocation.reversalReason = reason || 'Reversed by user';
    await allocation.save();

    // Recalculate sale status
    const newStatus = await accountingService.recalculateSaleStatus(allocation.sale);

    await AuditLog.create({
      user: req.user.id,
      entityType: 'PaymentAllocation',
      entityId: allocation._id,
      action: 'deallocate',
      before,
      after: allocation.toObject(),
      ip: req.ip
    });

    return success(res, {
      allocation,
      saleStatus: newStatus
    }, 'Allocation reversed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllocations,
  createAllocation,
  reverseAllocation
};
