
const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

// Event API routes
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.post('/', auth, role('official', 'admin'), eventController.createEvent);
router.post('/:id/register', auth, eventController.registerForEvent);
router.put('/:id', auth, role('official', 'admin'), eventController.updateEvent);
router.delete('/:id', auth, role('official', 'admin'), eventController.deleteEvent);

module.exports = router;
