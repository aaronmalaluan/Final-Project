
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");

// Register a new resident
router.post("/register", authController.register);
router.post("/register/send-otp", authController.sendRegistrationOtp);

// Login
router.post("/login", authController.login);

// Verify the email code sent during login
router.post("/verify-otp", authController.verifyOtp);

// Check logged-in user
router.get("/me", authController.me);

// Logout
router.post("/logout", authController.logout);

module.exports = router;
