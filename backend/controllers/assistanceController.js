const db = require('../config/database');

exports.getPrograms = async (req, res) => {
    try {
        const [programs] = await db.execute(
            'SELECT * FROM assistance_programs ORDER BY created_at DESC'
        );
        res.json(programs);
    } catch (error) {
        console.error('Get assistance programs error:', error);
        res.status(500).json({ message: 'Unable to retrieve assistance programs.' });
    }
};

exports.createProgram = async (req, res) => {
    const { title, category, description, eligibility, deadline } = req.body;
    if (!title || !category || !description) {
        return res.status(400).json({ message: 'Title, category, and description are required.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO assistance_programs
             (author_id, title, category, description, eligibility, deadline)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                title.trim(),
                category.trim(),
                description,
                eligibility || null,
                deadline || null
            ]
        );
        res.status(201).json({ message: 'Assistance program published.', id: result.insertId });
    } catch (error) {
        console.error('Create assistance program error:', error);
        res.status(500).json({ message: 'Unable to publish the assistance program.' });
    }
};
