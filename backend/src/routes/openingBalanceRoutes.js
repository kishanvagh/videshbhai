const express = require('express');
const router = express.Router();
const { getOpeningBalances, createOpeningBalance, updateOpeningBalance, deleteOpeningBalance } = require('../controllers/openingBalanceController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getOpeningBalances);
router.post('/', createOpeningBalance);
router.put('/:id', updateOpeningBalance);
router.delete('/:id', deleteOpeningBalance);

module.exports = router;
