const mongoose = require("mongoose");
const Comment = require("../models/commentModel");

// Create a comment
exports.createComment = async (req, res) => {
  try {
    const { articleID, userID, ...rest } = req.body;

    if (!articleID || !userID) {
      return res.status(400).json({
        status: "fail",
        message: "Article ID and user ID are required",
      });
    }
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
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "something is wrong",
    });
  }
};

// Update a comment
// PATCH:api/v1/comments/:id
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!comment)
      return res.status(404).json({
        status: "fail",
        message: "Comment does not exist",
      });

    res.status(200).json({
      status: "success",
      data: {
        comment,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Something is wrong",
    });
  }
};

// Delete a comment
// DELETE:api/v1/comments/:id
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);

    if (!comment) {
      return res.status(404).json({
        status: "fail",
        message: "Comment does not exist",
      });
    }

    // delete reply commnent
    if (!comment.parent) await Comment.deleteMany({ parent: comment._id });

    res.status(200).json({
      status: "success",
      message: "Comment deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Something is wrong",
    });
  }
};

// Get comments by article ID
// api/comments/article/:id
exports.getCommentByArticleId = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving comments",
    });
  }
};
