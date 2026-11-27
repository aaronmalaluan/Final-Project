const db = require('../config/database');

exports.getListings = async (req, res) => {
    try {
        const [listings] = await db.execute(
            `SELECT id, item_name, description, location, item_status, created_at
             FROM lost_found
             ORDER BY created_at DESC`
        );
        res.json(listings);
    } catch (error) {
        console.error('Get lost and found listings error:', error);
        res.status(500).json({ message: 'Unable to retrieve lost and found listings.' });
    }
};

exports.createListing = async (req, res) => {
    const { item_name, description, location, item_status } = req.body;
    if (!item_name || !location || !description) {
        return res.status(400).json({ message: 'Item name, location, and description are required.' });
    }
    if (!['Lost', 'Found'].includes(item_status)) {
        return res.status(400).json({ message: 'Listing type must be Lost or Found.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO lost_found (user_id, item_name, description, location, item_status)
             VALUES (?, ?, ?, ?, ?)`,
            [req.session.userId, item_name.trim(), description, location.trim(), item_status]
        );
        res.status(201).json({ message: 'Listing submitted.', id: result.insertId });
    } catch (error) {
        console.error('Create lost and found listing error:', error);
        res.status(500).json({ message: 'Unable to submit the listing.' });
    }
};

exports.updateListingStatus = async (req, res) => {
    const { id } = req.params;
    const { item_status } = req.body;

    if (!/^\d+$/.test(id) || Number(id) < 1) {
        return res.status(400).json({ message: 'Invalid listing ID.' });
    }
    if (!['Lost', 'Found', 'Returned'].includes(item_status)) {
        return res.status(400).json({ message: 'Status must be Lost, Found, or Returned.' });
    }

    try {
        const [listings] = await db.execute(
            `SELECT id FROM lost_found WHERE id = ?`,
            [id]
        );
        if (!listings.length) {
            return res.status(404).json({ message: 'Listing not found.' });
        }

        await db.execute(
            `UPDATE lost_found SET item_status = ? WHERE id = ?`,
            [item_status, id]
        );

        res.json({ message: 'Listing status updated.', item_status });
    } catch (error) {
        console.error('Update lost and found listing status error:', error);
        res.status(500).json({ message: 'Unable to update the listing status.' });
    }
};

exports.deleteFoundListing = async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id) || Number(id) < 1) {
        return res.status(400).json({ message: 'Invalid listing ID.' });
    }

    try {
        const [result] = await db.execute(
            `DELETE FROM lost_found
             WHERE id = ? AND item_status = 'Found'`,
            [id]
        );
        if (!result.affectedRows) {
            return res.status(404).json({ message: 'Found listing not found.' });
        }

        res.json({ message: 'Found listing deleted.' });
    } catch (error) {
        console.error('Delete found listing error:', error);
        res.status(500).json({ message: 'Unable to delete the found listing.' });
    }
};
