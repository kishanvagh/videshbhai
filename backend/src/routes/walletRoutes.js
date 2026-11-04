const express = require('express');
const router = express.Router();
const { getAdjustments, createAdjustment, updateAdjustment, deleteAdjustment } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');

router.get('/adjustments', protect, getAdjustments);
router.post('/adjustments', protect, createAdjustment);
router.put('/adjustments/:id', protect, updateAdjustment);
router.delete('/adjustments/:id', protect, deleteAdjustment);

module.exports = router;
