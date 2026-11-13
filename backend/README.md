# Backend setup

## Deploy the complete app on Render

The frontend and API need to share the same origin for session-based registration and login to work reliably. Configure the existing Render web service to include both project folders:

1. In Render, set **Root Directory** to the repository root (leave it blank), not `backend`.
2. Set **Build Command** to:

   ```text
   cd backend && npm ci
   ```

3. Set **Start Command** to:

   ```text
   cd backend && npm start
   ```

4. Keep the existing database, session, and Gmail environment variables configured in Render, then deploy.
5. Use the Render service URL (for example, `https://final-project-ea59.onrender.com`) as the public app link. The root URL now serves the frontend and `/api` serves the API. Do not use the GitHub Pages URL for session-based registration.

## Gmail OAuth for verification codes

Registration first stores a temporary pending signup. The user then chooses **Send OTP** and the account is created only after the email address is verified. Login uses the account email and password without an OTP. Registration codes expire after 5 minutes, allow 5 attempts, and can be resent after a 60-second cooldown.

### Configure Gmail OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable the **Gmail API**, and configure the OAuth consent screen. If the app is in testing mode, add the Gmail sender as a test user.
2. Create an OAuth client ID for a **Web application** and add this authorized redirect URI exactly:

   ```text
   http://localhost:3001/oauth2/callback
   ```

3. Add the sender address and OAuth client ID/secret to `backend/.env`, using the names in `.env.example`. Keep `.env` private.
4. From the `backend` folder, run:

   ```powershell
   node scripts/get-gmail-refresh-token.js
   ```

5. Open the URL printed in the terminal, sign in as the Gmail sender, and approve access. The helper uses the `https://mail.google.com/` scope and exchanges the authorization code directly with Google. It prints the refresh token in the local terminal; add it as `GMAIL_REFRESH_TOKEN` in `backend/.env`. Do not share the token.
6. Restart the backend.

OTP delivery uses the Gmail API over HTTPS. The OAuth credentials and refresh token must belong to the same sender account configured as `GMAIL_USER`. Users receive codes at the email address on their CommuNect account; they do not need to authorize Gmail themselves. Google may expire refresh tokens for OAuth apps left in testing mode, so a token that stops working may need to be generated again.
