require("dotenv").config();
const keys = require("./keys");

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(bodyParser.json());

const { Pool } = require("pg");

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.error(err));
});

// Redis Client Setup
const redis = require("redis");
const redisClient = redis.createClient({
  socket: {
    host: keys.redisHost,
    port: Number(keys.redisPort),
  },
});
const redisPublisher = redisClient.duplicate();

app.get("/", (req, res) => {
  res.send("Hi there");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");

  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  try {
    const values = await redisClient.hGetAll("values");

    res.send(values);
  } catch (err) {
    console.log(`error getting current fib values: ${err}`);
    res.status(500).send(err.message);
  }
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high");
  }

  await redisClient.hSet("values", index, "Nothing yet!");
  await redisPublisher.publish("insert", index);
  await pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({ working: true });
});

async function start() {
  await redisClient.connect();
  await redisPublisher.connect();

  app.listen(5000, () => {
    console.log("listening");
  });
}

start();
