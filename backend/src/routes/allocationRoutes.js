const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const allocationController = require('../controllers/allocationController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

router.get('/', allocationController.getAllocations);

router.post(
  '/',
  [
    body('payment').isMongoId().withMessage('Valid payment ID is required'),
    body('sale').isMongoId().withMessage('Valid sale ID is required'),
    body('allocatedAmount').isFloat({ min: 0.01 }).withMessage('Allocated amount must be greater than zero'),
    validate
  ],
  allocationController.createAllocation
);

router.post('/:id/reverse', allocationController.reverseAllocation);
router.delete('/:id', allocationController.reverseAllocation);

module.exports = router;
