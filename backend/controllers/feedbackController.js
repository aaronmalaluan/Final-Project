const db = require('../config/database');

function maskResidentName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Resident';

    return parts.map(part => {
        const characters = Array.from(part);
        if (characters.length <= 2) return part;
        return `${characters[0]}${'*'.repeat(characters.length - 2)}${characters[characters.length - 1]}`;
    }).join(' ');
}

exports.getAllFeedback = async (req, res) => {
    try {
        const [feedback] = await db.execute(
            `SELECT f.id, f.rating, f.message, f.created_at,
                    u.fullname AS resident_name
             FROM feedback f
             JOIN users u ON f.user_id = u.id
             ORDER BY f.created_at DESC`
        );

        res.json({
            feedback: feedback.map(item => ({
                ...item,
                resident_name: maskResidentName(item.resident_name)
            }))
        });
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ message: 'Unable to retrieve feedback.' });
    }
};

exports.createFeedback = async (req, res) => {
    const { service, rating, comment } = req.body;
    const numericRating = Number(rating);

    if (!service || !comment) {
        return res.status(400).json({ message: 'Service and feedback are required.' });
    }
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO feedback (user_id, rating, message) VALUES (?, ?, ?)',
            [req.session.userId, numericRating, `Service: ${service.trim()}\n\n${comment}`]
        );
        res.status(201).json({ message: 'Thank you for your feedback.', id: result.insertId });
    } catch (error) {
        console.error('Create feedback error:', error);
        res.status(500).json({ message: 'Unable to submit feedback.' });
    }
};
