const mongoose = require("mongoose");
const multer = require("multer");
const sharp = require("sharp");

const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Sign token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRECT, {
    expiresIn: process.env.JWT_EXPIRES_IN, // 90d
  });
};

// Create and send token
const createAndSendToken = (user, status, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000 //90d
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;
  res.status(status).json({
    status,
    token,
    data: {
      user,
    },
  });
};

// Create a user
// POST:api/v1/auth/signup
exports.createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    createAndSendToken(user, 201, res);
  } catch (err) {
    // lỗi xác thực
    if (err.name === "ValidationError") {
      return res.status(400).json({
        status: "fail",
        message: err.message,
      });
    }

    if (err.code === 11000) {
      // Lỗi trùng lặp
      return res.status(400).json({
        status: "fail",
        message: "Email already exists",
      });
    }

    // Xử lý lỗi chung
    res.status(500).json({
      status: "error",
      message: "An error occurred while creating the user",
    });
  }
};

//Authorization
exports.restrictTo = (...role) => {
  return (req, res, next) => {
    if (!role.includes(req.user.role)) {
      return res.status(403).json({
        status: "fail",
        message: "you do not have permission to perform this action",
      });
    }
    next();
  };
};

// Login
// POST:api/v1/auth/login
exports.logIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

    if (!email || !password)
      return res.status(400).json({
        status: "fail",
        message: "Email and password cannot be empty",
      });

    const user = await User.findOne({ email }).select("+password");

    const correct = await user.correctPassword(password, user.password);

    if (!user || !correct)
      return res.status(400).json({
        status: "fail",
        message: "Incorrect email or password",
      });

    createAndSendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while login",
    });
  }
};

// Protect
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in",
      });
    }

    const decoded = await util.promisify(jwt.verify)(
      token,
      process.env.JWT_SECRECT
    );

    const currentUser = await User.findById(decoded.id);
    if (!currentUser || !currentUser.isActived) {
      return res.status(404).json({
        status: "fail",
        message: "User does not exist",
      });
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(400).json({
        status: "fail",
        message: "Your password has just been changed. Please log in again",
      });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: "Something is wrong",
    });
  }
};

// Get a user
// GET:api/v1/users/:id
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "No user ID provided",
      });
    }

    const user = await User.findById(id);

    if (!user)
      return res
        .status(404)
        .json({ status: "fail", message: "User does not exist" });

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving user information",
    });
  }
};

// Update a user
// PATCH:api/v1/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: "fail",
        message: "No user ID provided",
      });
    }

    const user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user)
      return res.status(404).json({
        status: "fail",
        message: "User does not exist",
      });

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating user",
    });
  }
};

// Change pasword
// PATCH:api/v1/auth/:id
exports.updateMyPassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("+password");
    if (
      (await user.correctPassword(req.body.password, user.password)) === false
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Incorrect password",
      });
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();
    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while changing password",
    });
  }
};

//setup multer - upload images
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Không phải hình ảnh", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single("photo");
exports.resizeUserPhoto = async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`img/users/${req.file.filename}`);

  next();
};

// Get all users with pagination , sort, search
// GET:api/v1/users

exports.getAllUsers = async (req, res) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const sortField = req.query.sortField || "createdAt";
  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
  const filters = {};

  if (req.query.keyword) {
    filters.$or = [
      { userName: { $regex: req.query.keyword, $options: "i" } },
      { fullName: { $regex: req.query.keyword, $options: "i" } },
      { email: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  try {
    const skip = (page - 1) * limit;

    const users = await User.find(filters)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(filters);

    // SEND RESPONSE
    res.status(200).json({
      status: "success",
      results: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      data: {
        users,
      },
    });
  } catch (error) {
    res.status(500).json({ status: error, message: "Something is wrong" });
  }
};
