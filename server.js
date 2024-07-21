const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");
const app = require("./main");

dotenv.config({ path: "config.env" });

// connect database
const client = new MongoClient(process.env.URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

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
