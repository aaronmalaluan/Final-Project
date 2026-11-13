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

exports.deleteProgram = async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id) || Number(id) < 1) {
        return res.status(400).json({ message: 'Invalid assistance program ID.' });
    }

    try {
        const [result] = await db.execute(
            'DELETE FROM assistance_programs WHERE id = ?',
            [id]
        );
        if (!result.affectedRows) {
            return res.status(404).json({ message: 'Assistance program not found.' });
        }

        res.json({ message: 'Assistance program deleted.' });
    } catch (error) {
        console.error('Delete assistance program error:', error);
        res.status(500).json({ message: 'Unable to delete the assistance program.' });
    }
};
