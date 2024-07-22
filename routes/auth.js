const express = require("express");
const userController = require("../controllers/user");

const router = express.Router();

router.route("/signup").post(userController.createUser);

router.route("/login").post(userController.logIn);

router.route("/:id").patch(userController.updateMyPassword);

module.exports = router;
