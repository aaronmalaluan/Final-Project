function getResponseError(response, payload, action) {
    const body = payload && typeof payload === "object" ? payload : {};
    const apiError = body.error;
    const details = apiError && typeof apiError === "object" ? apiError : {};
    const code = typeof apiError === "string"
        ? apiError
        : details.status || `HTTP_${response.status}`;
    const message = body.error_description || details.message ||
        (typeof apiError === "string" ? apiError : response.statusText);
    const error = new Error(`Google ${action} failed (${response.status}): ${message}`);
    error.code = code;
    return error;
}

async function readGoogleResponse(response, action) {
    const raw = await response.text();
    let payload = {};
    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            throw new Error(`Google ${action} returned an invalid response (HTTP ${response.status}).`);
        }
    }

    if (!response.ok) {
        throw getResponseError(response, payload, action);
    }
    return payload;
}

function base64Url(value) {
    return Buffer.from(value, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function singleLineHeader(value, name) {
    if (typeof value !== "string" || !value || /[\r\n]/.test(value)) {
        throw new Error(`Invalid ${name}.`);
    }
    return value;
}

async function sendVerificationCode(recipient, code) {
    const requiredConfig = [
        "GMAIL_USER",
        "GMAIL_CLIENT_ID",
        "GMAIL_CLIENT_SECRET",
        "GMAIL_REFRESH_TOKEN"
    ];
    const missingConfig = requiredConfig.filter(name => !process.env[name]);

    if (missingConfig.length) {
        throw new Error(`Missing Gmail OAuth configuration: ${missingConfig.join(", ")}`);
    }

    const sender = singleLineHeader(process.env.GMAIL_USER, "Gmail sender");
    const destination = singleLineHeader(recipient, "recipient");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: "refresh_token"
        })
    });
    const token = await readGoogleResponse(tokenResponse, "OAuth token request");
    if (!token.access_token) {
        throw new Error("Google OAuth response did not contain an access token.");
    }

    const message = [
        `From: CommuNect <${sender}>`,
        `To: ${destination}`,
        "Subject: Your CommuNect verification code",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        `Your verification code is ${code}. It expires in 5 minutes. If you did not try to log in, you can ignore this email.`
    ].join("\r\n");

    const sendResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: base64Url(message) })
        }
    );
    await readGoogleResponse(sendResponse, "Gmail send request");
}

module.exports = { sendVerificationCode };
