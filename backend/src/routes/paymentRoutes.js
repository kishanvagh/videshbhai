const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', paymentController.getPayments);

router.post(
  '/',
  [
    body('party').isMongoId().withMessage('Valid party ID is required'),
    body('amountReceived').isFloat({ min: 0.01 }).withMessage('Amount received must be greater than zero'),
    body('currency').optional().notEmpty().withMessage('Currency must not be empty'),
    validate
  ],
  paymentController.createPayment
);

router.get('/outstanding/:partyId', paymentController.getOutstandingByParty);
router.get('/:id', paymentController.getPayment);
router.post('/:id/reverse', paymentController.reversePayment);

module.exports = router;
