
const db = require('../config/database');

// OVERVIEW DASHBOARD
exports.getOverview = async (req, res) => {
    try {

        const [[reportStats]] = await db.execute(`
            SELECT
                COUNT(*) AS total_reports,

                SUM(status = 'Pending') AS pending_reports,

                SUM(status = 'Resolved') AS resolved_reports,

                SUM(status = 'In Progress') AS ongoing_reports

            FROM concerns
        `);

        const [[eventStats]] = await db.execute(`
            SELECT COUNT(*) AS upcoming_events
            FROM events
            WHERE event_date >= NOW()
        `);

        res.json({
            totalReports: reportStats.total_reports,
            pendingReports: reportStats.pending_reports,
            resolvedReports: reportStats.resolved_reports,
            ongoingReports: reportStats.ongoing_reports,
            upcomingEvents: eventStats.upcoming_events
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Unable to load analytics.'
        });
    }
};

// COMMON COMMUNITY CONCERNS
exports.getConcernAnalytics = async (req, res) => {
    try {
        const [results] = await db.execute(`
            SELECT
                category,
                COUNT(*) AS total
            FROM concerns
            GROUP BY category
            ORDER BY total DESC
        `);

        res.json(results);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve concern analytics.'
        });
    }
};

// EVENT PARTICIPATION
exports.getEventAnalytics = async (req, res) => {
    try {
        const [results] = await db.execute(`
            SELECT
                e.title,
                COUNT(er.id) AS participants
            FROM events e
            LEFT JOIN event_registrations er
                ON e.id = er.event_id
            GROUP BY e.id, e.title
            ORDER BY participants DESC
        `);

        res.json(results);

    } catch (error) {
        res.status(500).json({
            message: 'Unable to retrieve event analytics.'
        });
    }
};
