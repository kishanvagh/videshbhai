const express = require('express');
const router = express.Router({ mergeParams: true });
const { getINRPayments, addINRPayment, deleteINRPayment } = require('../controllers/exchangeINRPaymentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getINRPayments);
router.post('/', addINRPayment);
router.delete('/:paymentId', deleteINRPayment);

module.exports = router;
