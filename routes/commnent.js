const express = require("express");

const commentController = require("../controllers/comment");

const router = express.Router();

router.route("/").post(commentController.createComment);
router
  .route("/:id")
  .patch(commentController.updateComment)
  .delete(commentController.deleteComment);

router.route("/articles/:id").get(commentController.getCommentByArticleId);

module.exports = router;
