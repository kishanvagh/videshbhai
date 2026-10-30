const ExchangeINRPayment = require('../models/ExchangeINRPayment');
const CurrencyExchange = require('../models/CurrencyExchange');
const AuditLog = require('../models/AuditLog');
const decimal = require('../utils/decimal');
const { success, error } = require('../utils/apiResponse');

// Get all INR payments for an exchange
const getINRPayments = async (req, res, next) => {
  try {
    const exchange = await CurrencyExchange.findOne({ _id: req.params.exchangeId, user: req.user.id });
    if (!exchange) return error(res, 'Exchange not found', 404);
    const payments = await ExchangeINRPayment.find({ exchange: req.params.exchangeId, user: req.user.id }).sort({ paymentDate: 1 });
    return success(res, payments);
  } catch (err) { next(err); }
};

// Add an INR payment installment
const addINRPayment = async (req, res, next) => {
  try {
    const exchange = await CurrencyExchange.findOne({ _id: req.params.exchangeId, user: req.user.id });
    if (!exchange) return error(res, 'Exchange not found', 404);

    const { amountINR, paymentDate, notes, referenceNumber } = req.body;
    const amount = parseFloat(amountINR);
    if (!amount || amount <= 0) return error(res, 'Amount must be greater than zero', 400);

    // Use exchange's current inrReceivedAmount as the base (additive approach)
    const currentReceived = parseFloat(exchange.inrReceivedAmount || 0);
    if (decimal.add(currentReceived, amount) > exchange.netINRReceived + 0.01) {
      return error(res, `Total INR payments (${decimal.round2(decimal.add(currentReceived, amount))}) would exceed expected INR (${exchange.netINRReceived})`, 400);
    }

    const payment = await ExchangeINRPayment.create({
      user: req.user.id,
      exchange: exchange._id,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amountINR: decimal.round2(amount),
      notes,
      referenceNumber,
    });

    // Update exchange's inrReceivedAmount additively
    const newTotalPaid = decimal.round2(decimal.add(currentReceived, amount));
    exchange.inrReceivedAmount = newTotalPaid;
    exchange.inrPendingAmount = decimal.round2(decimal.subtract(exchange.netINRReceived, newTotalPaid));
    exchange.paymentReceivedPercent = Math.min(100, Math.round((newTotalPaid / exchange.netINRReceived) * 100));
    await exchange.save();

    await AuditLog.create({ user: req.user.id, entityType: 'ExchangeINRPayment', entityId: payment._id, action: 'create', after: payment.toObject(), ip: req.ip });
    return success(res, { payment, exchange }, 'INR payment recorded successfully', 201);
  } catch (err) { next(err); }
};

// Delete an INR payment installment
const deleteINRPayment = async (req, res, next) => {
  try {
    const payment = await ExchangeINRPayment.findOne({ _id: req.params.paymentId, user: req.user.id });
    if (!payment) return error(res, 'Payment not found', 404);

    const exchange = await CurrencyExchange.findOne({ _id: payment.exchange, user: req.user.id });
    const deletedAmount = payment.amountINR;
    await ExchangeINRPayment.deleteOne({ _id: payment._id });

    if (exchange) {
      // Subtract deleted installment amount from current total (additive inverse)
      const newTotal = Math.max(0, decimal.round2(decimal.subtract(parseFloat(exchange.inrReceivedAmount || 0), deletedAmount)));
      exchange.inrReceivedAmount = newTotal;
      exchange.inrPendingAmount = decimal.round2(decimal.subtract(exchange.netINRReceived, newTotal));
      exchange.paymentReceivedPercent = exchange.netINRReceived > 0 ? Math.min(100, Math.round((newTotal / exchange.netINRReceived) * 100)) : 0;
      await exchange.save();
    }

    return success(res, null, 'INR payment deleted successfully');
  } catch (err) { next(err); }
};

module.exports = { getINRPayments, addINRPayment, deleteINRPayment };
