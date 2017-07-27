const client = require("./client.js");
const crypto = require("crypto");
const express = require("express");
const bodyParser = require("body-parser");
const travis = require("./travis.js");
const checkInactivity = require("./automations/checkInactivity.js");

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log("Website is running on http://localhost:" + port);
});

app.get("/", (req, res) => {
  res.redirect("https://github.com/zulip/zulipbot");
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post("/", (req, res) => {
  if (req.get("X-GitHub-Event")) {
    const signature = req.get("X-Hub-Signature");
    const hmac = crypto.createHmac("sha1", client.cfg.webhookSecret).update(JSON.stringify(req.body)).digest("hex");
    if (signature === `sha1=${hmac}`) {
      const validEvent = client.events.get(req.get("X-GitHub-Event"));
      if (validEvent) validEvent.run(client, req.body);
      return res.status(200).send("Valid request");
    }
  } else if (req.get("user-agent") && req.get("user-agent") === "Travis CI Notifications") {
    travis.run(client, JSON.parse(req.body.payload));
    return res.status(200).send("Valid request");
  }
  res.status(500).send("Invalid request");
});

process.on("unhandledRejection", (error, promise) => console.error("An unhandled promise rejection was detected at:", promise));

if (client.cfg.checkInactivityTimeout) setInterval(() => checkInactivity.run(client), client.cfg.checkInactivityTimeout * 1000);
