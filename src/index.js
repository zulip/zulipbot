"use strict"; // catch errors easier

// requirements
const express = require("express");
const bodyParser = require("body-parser");
const issues = require("./issues.js");
const pullRequests = require("./pullRequests.js");
const travisBuildStatus = require("./pullRequests/travisBuildStatus.js");

// server
const app = express(); // initialize express app
const port = process.env.PORT || 8080; // set post to 8080

app.listen(port, function() {
  console.log("Website is running on http://localhost:" + port); // localhost website testing
});

app.set("view engine", "ejs"); // set rendering engine

app.get("/", function(req, res) {
  res.redirect("https://github.com/zulip/zulipbot"); // redirect GET requests to GitHub repo
});

// parse JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// handle POST requests
app.post("/", function(req, res) {
  res.render("index"); // Send contents of index.ejs
  // check if event is for an issue opening or issue comment creation
  if (req.get("X-GitHub-Event").includes("issue")) {
    issues(req.body); // send parsed payload to issues.js
  }
  if (req.get("X-GitHub-Event").includes("pull_request")) {
    pullRequests(req.body); // send parsed payload to pullRequests.js
  }
});

app.post("/travis", function(req, res) {
  res.render("index"); // Send contents of index.ejs
  if (req.get("user-agent") === "Travis CI Notifications") {
    travisBuildStatus(req.body.payload);
  }
});
