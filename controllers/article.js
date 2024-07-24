const mongoose = require("mongoose");
const Article = require("./../models/articleModel");
const User = require("./../models/userModel");
const catchAsync = require("../catchAsync");
const AppError = require("../appError");

// Create a article
// POST:api/v1/articles
// privite - admin
exports.createArticle = catchAsync(async (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError("No data provided", 400));
  }
  const article = await Article.create(req.body);
  res.status(201).json({
    status: "success",
    data: {
      article,
    },
  });
});

// Get a article
// GET:api/v1/articles/:slug
exports.getArticle = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const article = await Article.findOne({ slug })
    .populate({ path: "likedUsers" })
    .populate({ path: "author" })
    .populate({ path: "comments" });

  if (!article) return next(new AppError("The article does not exist", 404));

  res.status(200).json({
    status: "success",
    data: {
      article,
    },
  });
});

// Update a article
// PATCH:api/v1/articles/:id
exports.updateArticle = catchAsync(async (req, res, next) => {
  const id = mongoose.Types.ObjectId(req.params.id);
  let article = await Article.findById(id);
  if (!article) return next(new AppError("Article is not found", 404));

  // Hearting article
  if (req.body.type === "heart") {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return next(new AppError("User is not found", 404));

    if (!article.likedUsers.includes(user._id)) {
      article.numLikes += 1;
      article.likedUsers.push(user._id);
    } else {
      article.numLikes -= 1;
      article.likedUsers = article.likedUsers.filter(
        (user) => user._id.toString() !== req.params.id.toString()
      );
    }
    await article.save();
  }

  Object.assign(article, req.body);
  await article.save();

  res.status(200).json({
    status: "success",
    data: {
      article,
    },
  });
});

// get all articles
// GET:api/v1/articles
exports.getAllArticles = catchAsync(async (req, res, next) => {
  // 1. BUID QUERY
  let query = Article.aggregate()
    .match({ isPublic: true })
    .lookup({
      from: "users",
      localField: "author",
      foreignField: "_id",
      as: "author",
    })
    .lookup({
      from: "users",
      localField: "likedUsers",
      foreignField: "_id",
      as: "likedUsers",
    });

  // keyword - title
  if (req.query.keyword) {
    const keyword = req.query.keyword;
    query.match({
      $or: [
        { title: { $regex: keyword, $options: "i" } },
        { tags: { $regex: keyword, $options: "i" } },
      ],
    });
  }
  // sort by num likes
  if (req.query.sortBy) {
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === desc ? -1 : 1;
    query = query.sort({ [sortBy]: sortOrder });
  }

  // pagination
  const page = req.query.page * 10 || 1;
  const limit = req.query.limit * 1 || 5;
  const skip = (page - 1) * limit;

  if (req.query.page) {
    query = query.skip(skip).limit(limit);
  }

  // 2. EXECUSE QUERY
  const articles = await query.exec();
  const numArticles = await Article.countDocuments({ isPublic: true });
  if (skip >= numArticles && req.query.page) {
    return next(new AppError("This page does not exist", 404));
  }

  // 3. RESPONSE
  res.status(200).json({
    status: "success",
    results: articles.length,
    totalPages: Math.ceil(numArticles / limit),
    data: {
      articles,
    },
  });
});
