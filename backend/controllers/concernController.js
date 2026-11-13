
const db = require('../config/database');

// RESIDENT: SUBMIT CONCERN
exports.createConcern = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            location
        } = req.body;

        if (!title || !description || !category) {
            return res.status(400).json({
                message: 'Please complete the required fields.'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO concerns
            (user_id, title, description, category, location)
            VALUES (?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                title,
                description,
                category,
                location || null
            ]
        );

        res.status(201).json({
            message: 'Concern submitted successfully!',
            concernId: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Unable to submit concern.'
        });
    }
};

// RESIDENT: VIEW OWN CONCERNS
exports.getMyConcerns = async (req, res) => {
    try {
        const [concerns] = await db.execute(
            `SELECT * FROM concerns
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        res.json(concerns);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve concerns.'
        });
    }
};

// OFFICIAL: VIEW ALL CONCERNS
exports.getAllConcerns = async (req, res) => {
    try {
        const [concerns] = await db.execute(
            `SELECT c.*, u.fullname AS resident_name
             FROM concerns c
             LEFT JOIN users u ON c.user_id = u.id
             ORDER BY c.created_at DESC`
        );

        res.json(concerns);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve reports.'
        });
    }
};

// OFFICIAL: UPDATE CONCERN STATUS
exports.updateConcernStatus = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            'Pending',
            'Under Review',
            'In Progress',
            'Resolved',
            'Rejected'
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status.'
            });
        }

        const hasUpdateMessage =
            typeof req.body.update_message === 'string' && !!req.body.update_message.trim();
        const update_message = hasUpdateMessage
            ? req.body.update_message.trim()
            : `Status changed to ${status}.`;

        await connection.beginTransaction();

        const [result] = await connection.execute(
            `UPDATE concerns SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: 'Concern not found.'
            });
        }

        await connection.execute(
            `INSERT INTO concern_updates
            (concern_id, official_id, update_message, status)
            VALUES (?, ?, ?, ?)`,
            [
                id,
                req.session.userId,
                update_message,
                status
            ]
        );

        const [owner] = await connection.execute(
            'SELECT user_id FROM concerns WHERE id = ?',
            [id]
        );

        await connection.execute(
            `INSERT INTO notifications
            (user_id, title, message)
            VALUES (?, ?, ?)`,
            [
                owner[0].user_id,
                'Concern Status Updated',
                `Your concern status is now: ${status}.${hasUpdateMessage ? ` ${update_message}` : ''}`
            ]
        );

        await connection.commit();

        res.json({
            message: 'Concern status updated successfully!'
        });

    } catch (error) {
        await connection.rollback();

        console.error(error);

        res.status(500).json({
            message: 'Unable to update concern.'
        });

    } finally {
        connection.release();
    }
};

// OFFICIAL: DELETE CONCERN
exports.deleteConcern = async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id) || Number(id) < 1) {
        return res.status(400).json({
            message: 'Invalid concern ID.'
        });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        await connection.execute(
            'DELETE FROM concern_updates WHERE concern_id = ?',
            [id]
        );
        const [result] = await connection.execute(
            'DELETE FROM concerns WHERE id = ?',
            [id]
        );

        if (!result.affectedRows) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Concern not found.'
            });
        }

        await connection.commit();
        res.json({
            message: 'Concern deleted.'
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Delete concern error:', error);
        res.status(500).json({
            message: 'Unable to delete the concern.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// RESIDENT: VIEW CONCERN HISTORY
exports.getConcernUpdates = async (req, res) => {
    try {
        const { id } = req.params;

        const [concerns] = await db.execute(
            `SELECT id FROM concerns
             WHERE id = ? AND user_id = ?`,
            [id, req.session.userId]
        );

        if (concerns.length === 0) {
            return res.status(404).json({
                message: 'Concern not found.'
            });
        }

        const [updates] = await db.execute(
            `SELECT cu.*, u.fullname AS official_name
             FROM concern_updates cu
             JOIN users u ON cu.official_id = u.id
             WHERE cu.concern_id = ?
             ORDER BY cu.created_at ASC`,
            [id]
        );

        res.json(updates);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve updates.'
        });
    }
};
