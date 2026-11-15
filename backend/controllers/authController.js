
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/database");
const { sendVerificationCode } = require("../services/emailService");

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_LIFETIME_MS = 30 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_RESPONSE_MESSAGE =
    "If an account exists for that email, check the inbox for a password reset code.";
const PASSWORD_RESET_INVALID_MESSAGE =
    "Invalid or expired password reset details. Request a new code and try again.";

function saveSession(session) {
    return new Promise((resolve, reject) => {
        session.save(error => error ? reject(error) : resolve());
    });
}

function regenerateSession(session) {
    return new Promise((resolve, reject) => {
        session.regenerate(error => error ? reject(error) : resolve());
    });
}

function hashOtp(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
}

function isValidOtp(code, pendingOtp) {
    if (!/^\d{6}$/.test(code)) return false;
    const storedHash = Buffer.from(pendingOtp.codeHash, "hex");
    const submittedHash = Buffer.from(hashOtp(code), "hex");
    return storedHash.length === submittedHash.length &&
        crypto.timingSafeEqual(storedHash, submittedHash);
}

async function createOtpChallenge(
    req,
    purpose,
    data,
    recipient,
    regenerate = false,
    sessionKey = "pendingOtp"
) {
    if (regenerate) {
        await regenerateSession(req.session);
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    req.session[sessionKey] = {
        ...data,
        purpose,
        codeHash: hashOtp(code),
        expiresAt: Date.now() + OTP_LIFETIME_MS,
        attempts: 0
    };
    await saveSession(req.session);

    try {
        await sendVerificationCode(recipient, code, purpose);
    } catch (error) {
        delete req.session[sessionKey];
        await saveSession(req.session);
        const deliveryError = new Error("Verification code delivery failed.");
        deliveryError.code = "OTP_DELIVERY_FAILED";
        deliveryError.cause = error;
        throw deliveryError;
    }
}

// REGISTER
exports.register = async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        if (
            typeof full_name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !full_name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Please complete all required fields."
            });
        }

        if (full_name.trim().length > 100 || email.trim().length > 150) {
            return res.status(400).json({
                message: "Name or email exceeds the allowed length."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        const normalizedEmail = email.trim();

        const [existing] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "Email is already registered."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await regenerateSession(req.session);
        req.session.pendingRegistration = {
            fullName: full_name.trim(),
            email: normalizedEmail,
            passwordHash,
            expiresAt: Date.now() + REGISTRATION_LIFETIME_MS
        };
        await saveSession(req.session);

        res.status(202).json({
            message: "Continue to email verification, then choose Send OTP.",
            requiresOtp: true,
            purpose: "register",
            otpSent: false
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            message: "Registration failed."
        });
    }
};

// SEND REGISTRATION OTP
exports.sendRegistrationOtp = async (req, res) => {
    try {
        const pendingRegistration = req.session.pendingRegistration;
        if (!pendingRegistration) {
            return res.status(401).json({
                message: "No pending registration. Please create your account again."
            });
        }

        if (Date.now() > pendingRegistration.expiresAt) {
            delete req.session.pendingRegistration;
            delete req.session.pendingOtp;
            await saveSession(req.session);
            return res.status(401).json({
                message: "Registration expired. Please create your account again."
            });
        }

        const cooldownRemaining =
            OTP_RESEND_COOLDOWN_MS - (Date.now() - (pendingRegistration.lastOtpSentAt || 0));
        if (cooldownRemaining > 0) {
            return res.status(429).json({
                message: `Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds before requesting another code.`
            });
        }

        const [existing] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            [pendingRegistration.email]
        );
        if (existing.length > 0) {
            delete req.session.pendingRegistration;
            delete req.session.pendingOtp;
            await saveSession(req.session);
            return res.status(409).json({
                message: "Email is already registered."
            });
        }

        try {
            await createOtpChallenge(
                req,
                "register",
                {
                    fullName: pendingRegistration.fullName,
                    email: pendingRegistration.email,
                    passwordHash: pendingRegistration.passwordHash
                },
                pendingRegistration.email
            );
        } catch (error) {
            if (error.code !== "OTP_DELIVERY_FAILED") throw error;
            console.error(
                "Registration OTP delivery failed:",
                error.cause.code || "unknown",
                error.cause.message
            );
            return res.status(503).json({
                message: "Could not send the verification code. Check the Gmail API and OAuth configuration."
            });
        }

        pendingRegistration.lastOtpSentAt = Date.now();
        await saveSession(req.session);
        res.json({
            message: "Verification code sent. Check your email.",
            otpSent: true
        });
    } catch (error) {
        console.error("Could not prepare registration verification:", error.code || "unknown");
        res.status(500).json({
            message: "Could not prepare email verification. Please try again."
        });
    }
};


// REQUEST PASSWORD RESET
exports.requestPasswordReset = async (req, res) => {
    try {
        const email = req.body && typeof req.body.email === "string"
            ? req.body.email.trim()
            : "";
        if (!email || email.length > 150) {
            return res.status(400).json({
                message: "Enter a valid email address."
            });
        }

        const now = Date.now();
        const cooldownRemaining =
            OTP_RESEND_COOLDOWN_MS - (now - (req.session.passwordResetLastSentAt || 0));
        if (cooldownRemaining > 0) {
            return res.status(429).json({
                message: `Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds before requesting another code.`
            });
        }

        req.session.passwordResetLastSentAt = now;
        delete req.session.pendingPasswordReset;
        await saveSession(req.session);

        const [users] = await db.execute(
            "SELECT id, email FROM users WHERE email = ?",
            [email]
        );
        if (users.length > 0) {
            try {
                await createOtpChallenge(
                    req,
                    "password_reset",
                    { userId: users[0].id, email: users[0].email },
                    users[0].email,
                    false,
                    "pendingPasswordReset"
                );
            } catch (error) {
                if (error.code !== "OTP_DELIVERY_FAILED") throw error;
                console.error(
                    "Password reset code delivery failed:",
                    error.cause && error.cause.code || "unknown"
                );
            }
        }

        return res.status(202).json({
            message: PASSWORD_RESET_RESPONSE_MESSAGE
        });
    } catch (error) {
        console.error("Could not start password reset:", error.code || "unknown");
        return res.status(500).json({
            message: "Could not start password reset. Please try again."
        });
    }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
    try {
        const email = req.body && typeof req.body.email === "string"
            ? req.body.email.trim()
            : "";
        const code = req.body && typeof req.body.otp === "string"
            ? req.body.otp.trim()
            : "";
        const password = req.body && typeof req.body.password === "string"
            ? req.body.password
            : "";

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        const pendingReset = req.session.pendingPasswordReset;
        if (!pendingReset || pendingReset.purpose !== "password_reset") {
            return res.status(401).json({
                message: PASSWORD_RESET_INVALID_MESSAGE
            });
        }

        if (Date.now() > pendingReset.expiresAt) {
            delete req.session.pendingPasswordReset;
            await saveSession(req.session);
            return res.status(401).json({
                message: PASSWORD_RESET_INVALID_MESSAGE
            });
        }

        const isValidRequest = email === pendingReset.email &&
            isValidOtp(code, pendingReset);
        if (!isValidRequest) {
            pendingReset.attempts += 1;
            const attemptsRemaining = OTP_MAX_ATTEMPTS - pendingReset.attempts;
            if (attemptsRemaining <= 0) {
                delete req.session.pendingPasswordReset;
            }
            await saveSession(req.session);
            return res.status(401).json({
                message: PASSWORD_RESET_INVALID_MESSAGE
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        delete req.session.pendingPasswordReset;
        await saveSession(req.session);

        const [result] = await db.execute(
            "UPDATE users SET password = ? WHERE id = ? AND email = ?",
            [passwordHash, pendingReset.userId, pendingReset.email]
        );
        if (result.affectedRows !== 1) {
            return res.status(401).json({
                message: PASSWORD_RESET_INVALID_MESSAGE
            });
        }

        return res.json({
            message: "Password reset successfully. Log in with your new password."
        });
    } catch (error) {
        console.error("Password reset failed:", error.code || "unknown");
        return res.status(500).json({
            message: "Could not reset the password. Please try again."
        });
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const [users] = await db.execute(
            `SELECT id, fullname AS full_name, email, password, role
             FROM users
             WHERE email = ?`,
            [email.trim()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        await regenerateSession(req.session);
        req.session.userId = user.id;
        req.session.role = user.role;
        await saveSession(req.session);

        res.json({
            message: "Login successful.",
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            message: "Login failed."
        });
    }
};

// VERIFY REGISTRATION OR LOGIN OTP
exports.verifyOtp = async (req, res) => {
    try {
        const pendingOtp = req.session.pendingOtp;
        if (!pendingOtp) {
            return res.status(401).json({
                message: "No pending verification. Please start again."
            });
        }

        if (pendingOtp.purpose !== "register") {
            delete req.session.pendingOtp;
            await saveSession(req.session);
            return res.status(401).json({
                message: "No pending registration verification. Please create your account again."
            });
        }

        if (Date.now() > pendingOtp.expiresAt) {
            delete req.session.pendingOtp;
            await saveSession(req.session);
            return res.status(401).json({
                message: "The code expired. Choose Resend OTP to get another code."
            });
        }

        const code =
            req.body && typeof req.body.otp === "string" ? req.body.otp.trim() : "";
        if (!isValidOtp(code, pendingOtp)) {
            pendingOtp.attempts += 1;
            const attemptsRemaining = OTP_MAX_ATTEMPTS - pendingOtp.attempts;
            if (attemptsRemaining <= 0) {
                delete req.session.pendingOtp;
            }
            await saveSession(req.session);
            return res.status(401).json({
                message: attemptsRemaining > 0
                    ? `Invalid verification code. ${attemptsRemaining} attempt(s) remaining.`
                    : "Too many invalid codes. Choose Resend OTP to get another code."
            });
        }

        const pendingRegistration = req.session.pendingRegistration;
        if (!pendingRegistration || Date.now() > pendingRegistration.expiresAt) {
            delete req.session.pendingOtp;
            delete req.session.pendingRegistration;
            await saveSession(req.session);
            return res.status(401).json({
                message: "Registration expired. Please create your account again."
            });
        }

        const [existing] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            [pendingOtp.email]
        );

        if (existing.length > 0) {
            delete req.session.pendingOtp;
            delete req.session.pendingRegistration;
            await saveSession(req.session);
            return res.status(409).json({
                message: "Email is already registered."
            });
        }

        try {
            await db.execute(
                `INSERT INTO users (fullname, email, password, role)
                 VALUES (?, ?, ?, 'resident')`,
                [pendingOtp.fullName, pendingOtp.email, pendingOtp.passwordHash]
            );
        } catch (error) {
            if (error.code !== "ER_DUP_ENTRY") throw error;
            delete req.session.pendingOtp;
            delete req.session.pendingRegistration;
            await saveSession(req.session);
            return res.status(409).json({
                message: "Email is already registered."
            });
        }

        delete req.session.pendingOtp;
        delete req.session.pendingRegistration;
        await saveSession(req.session);
        return res.status(201).json({
            message: "Email verified. Your account has been created.",
            registrationComplete: true
        });
    } catch (error) {
        console.error("OTP verification failed:", error.code || "unknown");
        res.status(500).json({
            message: "Could not verify the code. Please try again."
        });
    }
};


// GET CURRENT USER
exports.me = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                message: "Not logged in."
            });
        }

        const [users] = await db.execute(
            "SELECT id, fullname AS full_name, email, role FROM users WHERE id = ?",
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "User account not found."
            });
        }

        res.json({ user: users[0] });

    } catch (error) {
        console.error("Session error:", error);
        res.status(500).json({
            message: "Could not retrieve user."
        });
    }
};


// LOGOUT
exports.logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Logged out successfully."
        });
    });
};
