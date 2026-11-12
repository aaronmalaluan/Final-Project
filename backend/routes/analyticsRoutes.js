const express = require('express');
const router = express.Router();

const controller = require('../controllers/analyticsController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.use(auth, role('official', 'admin'));

router.get('/overview', controller.getOverview);

router.get('/concerns', controller.getConcernAnalytics);

router.get('/events', controller.getEventAnalytics);

module.exports = router;