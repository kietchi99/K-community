const express = require("express");
const articleController = require("../controllers/article");

const router = express.Router();

router
  .route("/")
  .post(articleController.createArticle)
  .get(articleController.getAllArticles);

router
  .route("/:id")
  .get(articleController.getArticle)
  .patch(articleController.updateArticle);

module.exports = router;
