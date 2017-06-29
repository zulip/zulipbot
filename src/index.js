"use strict"; // catch errors easier

// requirements
const client = require("./client.js");
const express = require("express");
const bodyParser = require("body-parser");
const issues = require("./issues.js");
const pullRequests = require("./pullRequests.js");
const travis = require("./travis.js");
const checkInactivity = require("./issues/checkInactivity.js");
const checkMergeConflicts = require("./pullRequests/checkMergeConflicts.js");

// server
const app = express(); // initialize express app
const port = process.env.PORT || 8080; // set post to 8080

app.listen(port, () => {
  console.log("Website is running on http://localhost:" + port); // localhost website testing
});

app.set("view engine", "ejs"); // set rendering engine

app.get("/", (req, res) => {
  res.redirect("https://github.com/zulip/zulipbot"); // redirect GET requests to GitHub repo
});

// parse JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// handle POST requests
app.post("/", (req, res) => {
  res.render("index"); // Send contents of index.ejs
  // check if event is for an issue opening or issue comment creation
  if (req.get("X-GitHub-Event") && req.get("X-GitHub-Event").includes("issue")) {
    issues.run(client, req.body); // send parsed payload to issues.js
  } else if (req.get("X-GitHub-Event") && req.get("X-GitHub-Event").includes("pull_request")) {
    pullRequests.run(client, req.body); // send parsed payload to pullRequests.js
  } else if (req.get("X-GitHub-Event") && req.get("X-GitHub-Event") === "push" && client.cfg.checkMergeConflicts) {
    setTimeout(() => checkMergeConflicts(req.body, client), client.cfg.repoEventsDelay); // check pull requests for merge conflicts on repository push
  } else if (req.get("user-agent") && req.get("user-agent") === "Travis CI Notifications") {
    travis(JSON.parse(req.body.payload), client);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.log("An unhandled promise rejection was detected!\nPromise ", promise, "\nReason: ", reason);
});

if (client.cfg.checkInactivityTimeout) setInterval(() => checkInactivity(client), client.cfg.checkInactivityTimeout * 1000); // check every hour
