const express = require('express');
const router = express.Router();

const controller = require('../controllers/lostFoundController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.get('/', controller.getListings);
router.post('/', auth, controller.createListing);
router.delete('/:id', auth, role('official', 'admin'), controller.deleteFoundListing);

module.exports = router;
