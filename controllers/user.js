const mongoose = require("mongoose");
const multer = require("multer");
const sharp = require("sharp");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const catchAsync = require("../catchAsync");
const AppError = require("../appError");

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
exports.createUser = catchAsync(async (req, res, next) => {
  const user = await User.create(req.body);
  createAndSendToken(user, 201, res);
});

//Authorization
exports.restrictTo = (...role) => {
  return (req, res, next) => {
    if (!role.includes(req.user.role)) {
      return next(
        new AppError("you do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

// Login
// POST:api/v1/auth/login
exports.logIn = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new AppError("Email and password cannot be empty", 400));

  const user = await User.findOne({ email }).select("+password");

  const correct = await user.correctPassword(password, user.password);

  if (!user || !correct)
    return next(new AppError("Incorrect email or password", 400));

  createAndSendToken(user, 200, res);
});

// Protect
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new AppError("You are not logged in", 401));
  }

  const decoded = await util.promisify(jwt.verify)(
    token,
    process.env.JWT_SECRECT
  );

  const currentUser = await User.findById(decoded.id);
  if (!currentUser || currentUser.status === 0) {
    return next(new AppError("User does not exist", 404));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "Your password has just been changed. Please log in again",
        401
      )
    );
  }

  req.user = currentUser;
  next();
});

// Get a user
// GET:api/v1/users/:id
exports.getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) return next(new AppError("No user ID provided", 400));

  const user = await User.findById(id);

  if (!user) return next(new AppError("User does not exist", 404));

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

// Update a user
// PATCH:api/v1/users/:id
exports.updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) return next(new AppError("No user ID provided", 400));

  const user = await User.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!user) return next(new AppError("User does not exist", 404));

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

// Change pasword
// PATCH:api/v1/auth/:id
exports.updateMyPassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  if (
    (await user.correctPassword(req.body.password, user.password)) === false
  ) {
    return next(new AppError("Incorrect password", 400));
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
});

//setup multer - upload images
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single("photo");
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`img/users/${req.file.filename}`);

  next();
});

// Get all users with pagination , sort, search
// GET:api/v1/users

exports.getAllUsers = catchAsync(async (req, res, next) => {
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
});
