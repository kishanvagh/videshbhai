const express = require('express');
const router = express.Router();
const { getSalesReport, getPaymentsReport, getOutstandingReport, getProfitReport, getExchangeReport, getPartyStatement, exportCSV, getMonthlyTrend } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/sales', getSalesReport);
router.get('/payments', getPaymentsReport);
router.get('/outstanding', getOutstandingReport);
router.get('/profit', getProfitReport);
router.get('/currency-exchange', getExchangeReport);
router.get('/party-statement/:id', getPartyStatement);
router.get('/export/csv', exportCSV);
router.get('/monthly-trend', getMonthlyTrend);

module.exports = router;
