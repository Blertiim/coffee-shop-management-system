const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/pos-staff", authController.getPosStaffProfiles);
router.post("/pos-login", authController.posLogin);

module.exports = router;
