const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const partyController = require('../controllers/partyController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All party routes require authentication
router.use(protect);

router.get('/', partyController.getParties);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Party name is required'),
    body('country').trim().notEmpty().withMessage('Country is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    validate
  ],
  partyController.createParty
);

router.get('/:id', partyController.getParty);
router.put('/:id', partyController.updateParty);
router.get('/:id/ledger', partyController.getPartyLedger);
router.get('/:id/balances', partyController.getPartyBalances);

module.exports = router;
