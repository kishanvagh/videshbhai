const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const saleController = require('../controllers/saleController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', saleController.getSales);

router.post(
  '/',
  [
    body('party').isMongoId().withMessage('Valid party ID is required'),
    body('productName').trim().notEmpty().withMessage('Product name is required'),
    body('saleAmountINR').isFloat({ min: 0 }).withMessage('Sale amount in INR must be a positive number'),
    body('saleAmountForeign').optional().isFloat({ min: 0 }).withMessage('Sale amount foreign must be a positive number'),
    validate
  ],
  saleController.createSale
);

router.get('/:id', saleController.getSale);
router.put('/:id', saleController.updateSale);
router.post('/:id/cancel', saleController.cancelSale);

module.exports = router;
