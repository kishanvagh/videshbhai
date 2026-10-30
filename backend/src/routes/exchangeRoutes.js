const express = require('express');
const router = express.Router();
const { getExchanges, getCurrencyBalances, createExchange, updateExchange, reverseExchange, deleteExchange } = require('../controllers/exchangeController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/currency-balances', getCurrencyBalances);
router.get('/', getExchanges);
router.post('/', createExchange);
router.put('/:id', updateExchange);
router.post('/:id/reverse', reverseExchange);
router.delete('/:id', deleteExchange);

module.exports = router;
