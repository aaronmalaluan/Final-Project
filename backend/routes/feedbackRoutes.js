const express = require('express');
const router = express.Router();

const controller = require('../controllers/feedbackController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.get('/', auth, role('official', 'admin'), controller.getAllFeedback);
router.post('/', auth, controller.createFeedback);

module.exports = router;
