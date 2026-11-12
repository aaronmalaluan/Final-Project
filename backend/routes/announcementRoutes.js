const express = require('express');
const router = express.Router();

const controller = require('../controllers/announcementController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// Public announcements
router.get('/', controller.getAnnouncements);

// Official management
router.post('/', auth, role('official', 'admin'),
    controller.createAnnouncement
);

router.delete('/:id', auth, role('official', 'admin'),
    controller.deleteAnnouncement
);

module.exports = router;