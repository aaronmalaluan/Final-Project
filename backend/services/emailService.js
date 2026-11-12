const nodemailer = require("nodemailer");

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

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: process.env.GMAIL_USER,
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN
        }
    });

    await transporter.sendMail({
        from: {
            name: "CommuNect",
            address: process.env.GMAIL_USER
        },
        to: recipient,
        subject: "Your CommuNect verification code",
        text: `Your verification code is ${code}. It expires in 5 minutes. If you did not try to log in, you can ignore this email.`
    });
}

module.exports = { sendVerificationCode };
