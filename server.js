const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./main");

dotenv.config({ path: "config.env" });

// connect database
mongoose
  .connect(process.env.URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB Atlas", err);
  });

const PORT = process.env.PORT || 9000;
app.listen(9000, () => {
  console.log(`App running on port ${PORT}...`);
});

process.on("unhandleRejection", (err) => {
  console.log(err.name, err.message);
  console.log("UNHANDLE REJECTION");
  server.close(() => {
    process.exit(1);
  });
});
