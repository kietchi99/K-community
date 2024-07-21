const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");

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

app.get("/", function (req, res) {
  res.send("Hello Buddy");
});

module.exports = app;
