const mongoose = require("mongoose");
const Article = require("./../models/articleModel");
const User = require("./../models/userModel");
const catchAsync = require("../catchAsync");
const AppError = require("../appError");

// create a article
// [POST]: api/v1/articles
// privite - admin
exports.createArticle = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "No data provided",
      });
    }
    const article = await Article.create(req.body);
    res.status(201).json({
      status: "success",
      data: {
        article,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Something is wrong",
    });
  }
};

// Get a article
// GET:api/v1/articles/:slug
exports.getArticle = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const article = await Article.findOne({ slug })
      .populate({ path: "likedUsers" })
      .populate({ path: "author" })
      .populate({ path: "comments" });

    if (!article)
      return res.status(404).json({
        status: "fail",
        message: "The article does not exist",
      });

    res.status(200).json({
      status: "success",
      data: {
        article,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving the article",
    });
  }
};

// Update a article
// PATCH:api/v1/articles/:id
exports.updateArticle = async (req, res) => {
  try {
    const id = mongoose.Types.ObjectId(req.params.id);

    // hearting article
    if (req.body.type === "heart") {
      const article = await Article.findById(id);
      const user = await User.findOne({ email: req.body.email });

      if (!article)
        return res.status(404).json({
          status: "fail",
          message: "Article is not found",
        });

      if (!user)
        return res.status(404).json({
          status: "fail",
          message: "user is not found",
        });

      if (!article.likedUsers.includes(user._id)) {
        article.numLikes = article.numLikes + 1;
        article.likedUsers.push(user._id);
      } else {
        article.numLikes = article.numLikes - 1;
        article.likedUsers = article.likedUsers.filter(
          (user) => user._id.toString() !== req.params.id.toString()
        );
      }
      await article.save();
    }

    const article = await Article.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!article) {
      return res.status(404).json({
        status: "fail",
        message: "Article not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        article,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while updating the article",
    });
  }
};

// get all articles
// GET:api/v1/articles
exports.getAllArticles = async (req, res) => {
  try {
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
      return res.status(404).json({
        status: "fail",
        message: "This page does not exist",
      });
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
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Something is wrong",
    });
  }
};
