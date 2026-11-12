
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

// MIDDLEWARE
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));

app.use(express.json());

// MYSQL SESSION STORE
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions'
    }
});

app.use(session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// IMPORT ROUTES
const authRoutes = require('./routes/authRoutes');
const concernRoutes = require('./routes/concernRoutes');
const announcementRoutes = require('./routes/announcementRoutes');

// CONNECT ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/concerns', concernRoutes);
app.use('/api/announcements', announcementRoutes);

// ADDITIONAL MODULES
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/assistance', require('./routes/assistanceRoutes'));
app.use('/api/lost-found', require('./routes/lostFoundRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// HOME ROUTE
app.get('/', (req, res) => {
    res.send('CommuNect API is running!');
});

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`CommuNect running on port ${PORT}`);
});
