const express = require('express');
const router = express.Router();

const controller = require('../controllers/lostFoundController');
const auth = require('../middleware/authMiddleware');

router.get('/', controller.getListings);
router.post('/', auth, controller.createListing);

module.exports = router;
