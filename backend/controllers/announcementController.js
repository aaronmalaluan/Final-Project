
const db = require('../config/database');

// GET PUBLISHED ANNOUNCEMENTS
exports.getAnnouncements = async (req, res) => {
    try {
        const [announcements] = await db.execute(
            `SELECT a.*, u.fullname AS author_name
             FROM announcements a
             JOIN users u ON a.author_id = u.id
             WHERE a.published_at IS NOT NULL
               AND a.published_at <= NOW()
             ORDER BY a.published_at DESC`
        );

        res.json(announcements);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve announcements.'
        });
    }
};

// OFFICIAL: CREATE ANNOUNCEMENT
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, category, content } = req.body;

        if (!title || !category || !content) {
            return res.status(400).json({
                message: 'All fields are required.'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO announcements
            (author_id, title, category, content, published_at)
            VALUES (?, ?, ?, ?, NOW())`,
            [
                req.session.userId,
                title,
                category,
                content
            ]
        );

        res.status(201).json({
            message: 'Announcement published!',
            id: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            message: 'Unable to publish announcement.'
        });
    }
};

// OFFICIAL: DELETE ANNOUNCEMENT
exports.deleteAnnouncement = async (req, res) => {
    try {
        const [result] = await db.execute(
            'DELETE FROM announcements WHERE id = ?',
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: 'Announcement not found.'
            });
        }

        res.json({
            message: 'Announcement deleted.'
        });

    } catch (error) {
        res.status(500).json({
            message: 'Unable to delete announcement.'
        });
    }
};
