const express = require('express');
const router = express.Router();

const controller = require('../controllers/concernController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// All concern routes require login
router.use(auth);

// RESIDENT ROUTES
router.post('/', role('resident'), controller.createConcern);

router.get('/my-reports',
    role('resident'),
    controller.getMyConcerns
);

router.get('/:id/updates',
    role('resident'),
    controller.getConcernUpdates
);

// OFFICIAL ROUTES
router.get('/',
    role('official', 'admin'),
    controller.getAllConcerns
);

router.patch('/:id/status',
    role('official', 'admin'),
    controller.updateConcernStatus
);

module.exports = router;