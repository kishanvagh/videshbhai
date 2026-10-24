const express = require('express');
const router = express.Router();
const { getAuditLog } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getAuditLog);

module.exports = router;
