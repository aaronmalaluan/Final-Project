const db = require('../config/database');

function toMysqlDateTime(value) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        return null;
    }

    const normalized = value.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function parseCapacity(value) {
    if (value === undefined || value === null || value === '') {
        return { valid: true, value: null };
    }

    const capacity = Number(value);
    if (!Number.isInteger(capacity) || capacity < 1) {
        return { valid: false, value: null };
    }

    return { valid: true, value: capacity };
}

function validId(value) {
    return /^\d+$/.test(value) && Number(value) > 0;
}

exports.getAllEvents = async (req, res) => {
    try {
        const isOfficial = ['official', 'admin'].includes(req.session.role);
        const dateFilter = isOfficial ? '' : 'WHERE e.event_date >= NOW()';
        const [events] = await db.execute(
            `SELECT e.*, COUNT(er.id) AS participant_count
             FROM events e
             LEFT JOIN event_registrations er ON er.event_id = e.id
             ${dateFilter}
             GROUP BY e.id
             ORDER BY e.event_date ASC`
        );

        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Unable to retrieve events.' });
    }
};

exports.getEventById = async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid event ID.' });
    }

    try {
        const [events] = await db.execute(
            `SELECT e.*, COUNT(er.id) AS participant_count
             FROM events e
             LEFT JOIN event_registrations er ON er.event_id = e.id
             WHERE e.id = ?
             GROUP BY e.id`,
            [req.params.id]
        );

        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        res.json(events[0]);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Unable to retrieve the event.' });
    }
};

exports.createEvent = async (req, res) => {
    const { title, description, location } = req.body;
    const eventDate = toMysqlDateTime(req.body.event_date);
    const capacity = parseCapacity(req.body.capacity);
    const registrationDeadline = req.body.registration_deadline
        ? toMysqlDateTime(req.body.registration_deadline)
        : null;

    if (!title || !location || !eventDate) {
        return res.status(400).json({
            message: 'A title, location, and valid event date are required.'
        });
    }
    if (!capacity.valid) {
        return res.status(400).json({ message: 'Capacity must be a positive whole number.' });
    }
    if (req.body.registration_deadline && !registrationDeadline) {
        return res.status(400).json({ message: 'Registration deadline is invalid.' });
    }

    try {
        const [[dateCheck]] = await db.execute(
            'SELECT CAST(? AS DATETIME) > NOW() AS is_future',
            [eventDate]
        );
        if (!dateCheck.is_future) {
            return res.status(400).json({
                message: 'Choose a future date and time. Past events do not appear in Upcoming activities.'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO events
             (organizer_id, title, description, location, event_date, registration_deadline, capacity)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                title.trim(),
                description || null,
                location.trim(),
                eventDate,
                registrationDeadline,
                capacity.value
            ]
        );

        res.status(201).json({ message: 'Event created.', id: result.insertId });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Unable to create the event.' });
    }
};

exports.updateEvent = async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid event ID.' });
    }

    const { title, description, location } = req.body;
    const eventDate = toMysqlDateTime(req.body.event_date);
    const capacity = parseCapacity(req.body.capacity);
    const registrationDeadline = req.body.registration_deadline
        ? toMysqlDateTime(req.body.registration_deadline)
        : null;

    if (!title || !location || !eventDate) {
        return res.status(400).json({
            message: 'A title, location, and valid event date are required.'
        });
    }
    if (!capacity.valid) {
        return res.status(400).json({ message: 'Capacity must be a positive whole number.' });
    }
    if (req.body.registration_deadline && !registrationDeadline) {
        return res.status(400).json({ message: 'Registration deadline is invalid.' });
    }

    try {
        const [events] = await db.execute(
            'SELECT id FROM events WHERE id = ?',
            [req.params.id]
        );
        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        await db.execute(
            `UPDATE events
             SET title = ?, description = ?, location = ?, event_date = ?,
                 registration_deadline = ?, capacity = ?
             WHERE id = ?`,
            [
                title.trim(),
                description || null,
                location.trim(),
                eventDate,
                registrationDeadline,
                capacity.value,
                req.params.id
            ]
        );

        res.json({ message: 'Event updated.' });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ message: 'Unable to update the event.' });
    }
};

exports.deleteEvent = async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid event ID.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            'DELETE FROM event_registrations WHERE event_id = ?',
            [req.params.id]
        );
        const [result] = await connection.execute(
            'DELETE FROM events WHERE id = ?',
            [req.params.id]
        );

        if (!result.affectedRows) {
            await connection.rollback();
            return res.status(404).json({ message: 'Event not found.' });
        }

        await connection.commit();
        res.json({ message: 'Event deleted.' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Unable to delete the event.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

exports.registerForEvent = async (req, res) => {
    if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid event ID.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [events] = await connection.execute(
            `SELECT id, event_date, registration_deadline, capacity
             FROM events
             WHERE id = ?
             FOR UPDATE`,
            [req.params.id]
        );

        if (events.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Event not found.' });
        }

        const event = events[0];
        if (new Date(event.event_date) <= new Date()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Registration is closed for this event.' });
        }
        if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
            await connection.rollback();
            return res.status(400).json({ message: 'The registration deadline has passed.' });
        }

        const [existing] = await connection.execute(
            'SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'You are already registered for this event.' });
        }

        if (event.capacity !== null) {
            const [[count]] = await connection.execute(
                'SELECT COUNT(*) AS participants FROM event_registrations WHERE event_id = ?',
                [req.params.id]
            );
            if (count.participants >= event.capacity) {
                await connection.rollback();
                return res.status(409).json({ message: 'This event has reached capacity.' });
            }
        }

        await connection.execute(
            'INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)',
            [req.params.id, req.session.userId]
        );
        await connection.commit();

        res.status(201).json({ message: 'You are registered for this event.' });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'You are already registered for this event.' });
        }

        console.error('Event registration error:', error);
        res.status(500).json({ message: 'Unable to register for the event.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
