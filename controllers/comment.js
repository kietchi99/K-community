const mongoose = require("mongoose");
const Comment = require("../models/commentModel");
const catchAsync = require("../catchAsync");
const AppError = require("../appError");

// Create a comment
exports.createComment = catchAsync(async (req, res, next) => {
  const { articleID, userID, ...rest } = req.body;

  if (!articleID || !userID)
    return next(new AppError("Article ID and user ID are required", 400));

  const data = {
    ...rest,
    article: mongoose.Types.ObjectId(articleID),
    user: mongoose.Types.ObjectId(userID),
  };
  const comment = await Comment.create(data);

  res.status(201).json({
    status: "success",
    data: {
      comment,
    },
  });
});

// Update a comment
// PATCH:api/v1/comments/:id
exports.updateComment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const comment = await Comment.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!comment) return next(new AppError("Comment does not exist", 404));

  res.status(200).json({
    status: "success",
    data: {
      comment,
    },
  });
});

// Delete a comment
// DELETE:api/v1/comments/:id
exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findByIdAndDelete(req.params.id);

  if (!comment) return next(new AppError("Comment does not exist"), 404);

  // delete reply commnent
  if (!comment.parent) await Comment.deleteMany({ parent: comment._id });

  res.status(200).json({
    status: "success",
    message: "Comment deleted successfully",
  });
});

// Get comments by article ID
// api/comments/article/:id
exports.getCommentByArticleId = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;

  const query = Comment.find({ article: id })
    .populate({ path: "user" })
    .populate({ path: "article" })
    .populate({ path: "replyTo" })
    .sort({ createdAt: -1 });

  if (req.query.page) {
    query = query.skip(skip).limit(limit);
  }

  const comments = await query;

  const topComments = comments.filter((comment) => !comment.parent);

  const replyComments = comments.filter((comment) => comment.parent);

  res.status(200).json({
    status: "success",
    data: {
      comments,
      topComments,
      replyComments,
    },
  });
});
