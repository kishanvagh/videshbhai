const express = require('express');
const router = express.Router();
const { getSummary, getPartyTable, getCurrencyPositions } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/summary', getSummary);
router.get('/party-table', getPartyTable);
router.get('/currency-positions', getCurrencyPositions);

module.exports = router;
