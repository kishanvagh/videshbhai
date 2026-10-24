const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/apiResponse');

// @desc    Get audit logs
// @route   GET /api/audit
const getAuditLog = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    if (req.query.action) filter.action = req.query.action;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ performedAt: -1 })
      .skip(skip)
      .limit(limit);

    return success(res, {
      logs,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLog };
