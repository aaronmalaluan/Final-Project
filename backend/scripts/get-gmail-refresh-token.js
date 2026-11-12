require("dotenv").config();

const crypto = require("crypto");
const http = require("http");

const requiredConfig = ["GMAIL_USER", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"];
const missingConfig = requiredConfig.filter(name => !process.env[name]);

if (missingConfig.length) {
    console.error(`Set these values in backend/.env first: ${missingConfig.join(", ")}`);
    process.exit(1);
}

const port = 3001;
const redirectUri = `http://localhost:${port}/oauth2/callback`;
const state = crypto.randomBytes(32).toString("hex");
const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

authorizationUrl.search = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://mail.google.com/",
    access_type: "offline",
    prompt: "consent",
    login_hint: process.env.GMAIL_USER,
    state
}).toString();

const server = http.createServer(async (request, response) => {
    const callbackUrl = new URL(request.url, redirectUri);
    if (callbackUrl.pathname !== "/oauth2/callback") {
        response.writeHead(404).end("Not found");
        return;
    }

    if (callbackUrl.searchParams.get("state") !== state) {
        response.writeHead(400).end("OAuth state did not match. Close this page and try again.");
        return;
    }

    const authorizationError = callbackUrl.searchParams.get("error");
    const code = callbackUrl.searchParams.get("code");
    if (authorizationError || !code) {
        response.writeHead(400).end("Google authorization was not completed. You can close this page.");
        console.error(`Google authorization failed: ${authorizationError || "no authorization code"}`);
        server.close();
        return;
    }

    try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: process.env.GMAIL_CLIENT_ID,
                client_secret: process.env.GMAIL_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: "authorization_code"
            })
        });
        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok || !tokens.refresh_token) {
            response.writeHead(500).end("Google did not return a refresh token. Check the OAuth client setup and try again.");
            console.error(`Refresh token request failed: ${tokens.error || tokenResponse.status}`);
            server.close();
            return;
        }

        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Authorization complete. Close this page and copy the refresh token from the terminal.");
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        server.close();
    } catch (error) {
        response.writeHead(500).end("Could not complete the OAuth token request. Check the terminal.");
        console.error(`Refresh token request failed: ${error.code || "network error"}`);
        server.close();
    }
});

server.listen(port, "localhost", () => {
    console.log("Open this URL and authorize the Gmail sender account:");
    console.log(authorizationUrl.toString());
    console.log("The refresh token will be printed here after authorization.");
});
