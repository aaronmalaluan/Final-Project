
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const db = require('./config/database');

const app = express();

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
app.set('trust proxy', 1);

// MIDDLEWARE
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://aaronmalaluan.github.io'
    ],
    credentials: true
}));

app.use(express.json());

// MYSQL SESSION STORE
const sessionStore = new MySQLStore({
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions'
    }
}, db);

app.use(session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
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

const server = app.listen(PORT, () => {
    console.log(`CommuNect running on port ${PORT}`);
});

server.on('error', (err) => console.error('Server error:', err));
process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
process.on('exit', (code) => console.log('Process exiting with code', code));