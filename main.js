const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");

const userRouter = require("./routes/user");
const authRouter = require("./routes/auth");
//const articleRouter = require("./routes/article");
//const commentRouter = require("./routes/comment");

const app = express();

// 1. middlewares
app.use(express.json());
app.use(cors());
app.use(express.static(`${__dirname}/public`));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.requestTime = new Date().toISOTring;
  next();
});

if (process.env.NODE_ENV === "DEV") {
  app.use(morgan("dev"));
}

// 2. Routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);
//app.use("/api/v1/articles", articleRouter);
//app.use("/api/v1/comments", commentRouter);

app.get("/", function (req, res) {
  res.send("Hello Buddy");
});

module.exports = app;
