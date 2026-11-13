const express = require('express');
const router = express.Router();

const controller = require('../controllers/assistanceController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.get('/', controller.getPrograms);
router.post('/', auth, role('official', 'admin'), controller.createProgram);
router.delete('/:id', auth, role('official', 'admin'), controller.deleteProgram);

module.exports = router;
