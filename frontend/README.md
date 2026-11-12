# CommuNect Frontend

Responsive HTML/CSS/JavaScript frontend based on the CommuNect project description.

## 1. Folder placement

Extract this folder so your project looks like this:

```text
Final-Project-WST/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── README.md
└── backend/
    ├── server.js
    ├── package.json
    └── ...
```

## 2. Configure the backend address

Open `frontend/js/app.js`. At the top, check:

```js
const API_BASE = "http://localhost:3000/api";
```

This must match the port and API prefix used in your Express `server.js`.

## 3. Start MySQL and backend

1. Open XAMPP Control Panel.
2. Start **MySQL**. Start Apache only if you use phpMyAdmin.
3. Open a terminal in the `backend` folder.
4. Run `npm.cmd install` if dependencies have not been installed in this folder.
5. Configure Gmail OAuth in `backend/.env` as described in [the backend setup guide](../backend/README.md).
6. Run `npm.cmd run dev` if your package.json has a `dev` script, or `npm.cmd start` if it has a `start` script.
7. Confirm the terminal says the server is running on port 3000.

## 4. Run the frontend

Recommended: in VS Code, install the **Live Server** extension.

1. Open the whole `Final-Project-WST` folder in VS Code.
2. Right-click `frontend/index.html`.
3. Select **Open with Live Server**.
4. The page usually opens at `http://127.0.0.1:5500`.
5. Your backend CORS configuration must allow the exact Live Server origin.

Do not open the HTML file by double-clicking it if you are using session login. Use Live Server.

## 5. API routes expected by this frontend

| Feature | Method | Route |
|---|---|---|
| Begin registration | POST | `/api/auth/register` |
| Send or resend registration OTP | POST | `/api/auth/register/send-otp` |
| Login with email and password | POST | `/api/auth/login` |
| Verify registration code | POST | `/api/auth/verify-otp` |
| Current session | GET | `/api/auth/me` |
| Logout | POST | `/api/auth/logout` |
| Public announcements | GET | `/api/announcements` |
| Create announcement | POST | `/api/announcements` |
| Create concern | POST | `/api/concerns` |
| My concerns | GET | `/api/concerns/my-reports` |
| Official concern list | GET | `/api/concerns` |
| Update concern status | PATCH | `/api/concerns/:id/status` |
| Events | GET | `/api/events` |
| Create event | POST | `/api/events` |
| Register for event | POST | `/api/events/:id/register` |
| Assistance programs | GET | `/api/assistance` |
| Create assistance program | POST | `/api/assistance` |
| Lost and found | GET | `/api/lost-found` |
| Create lost/found listing | POST | `/api/lost-found` |
| Submit feedback | POST | `/api/feedback` |
| Official feedback list | GET | `/api/feedback` |
| Dashboard summary | GET | `/api/analytics/overview` |
| Concerns by category | GET | `/api/analytics/concerns` |

Official concern and feedback routes require an authenticated official or administrator account.

## 6. Session and CORS settings

For local development, the Express app should use the exact frontend origin, for example:

```js
app.use(cors({
  origin: "http://127.0.0.1:5500",
  credentials: true
}));
app.use(express.json());
```

If Live Server opens as `http://localhost:5500`, use that exact origin instead. The origin must match exactly.

Your session cookie should support local development, and the frontend fetch helper already uses:

```js
credentials: "include"
```

Never publish your `.env` file or real passwords. For production, use HTTPS, secure cookies, and appropriate CSRF protection.

## 7. Quick connection test

1. Start XAMPP MySQL.
2. Start your Express backend.
3. Open the frontend using Live Server.
4. Open browser Developer Tools (`F12`) → **Console** and **Network**.
5. Try registering a resident account, then log in and enter the verification code sent to that email.
6. If the browser reports a CORS error, check the allowed origin in `server.js`.
7. If it reports `404`, the requested API route has not been created or the route prefix differs.
8. If it reports `500`, inspect the backend terminal for the database or controller error.

## Notes

- Public registration is intended to create a **resident** account only. Do not allow users to choose the official/admin role in the registration form.
- Officials should be created or promoted securely by an administrator.
- The frontend uses plain HTML, CSS, and JavaScript. No React or build process is required.
- The dashboard shows live values only when the matching analytics endpoints are implemented and return the expected fields.
