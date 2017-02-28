"use strict";

// Requirements
const express = require("express");
const bodyParser = require("body-parser");
const issues = require("./issues.js");

// Server
const app = express();
const port = process.env.PORT || 8080;

app.listen(port, function() {
  console.log("Website is running on http://localhost:" + port);
});

app.set("view engine", "ejs");

app.get("/", function(req, res) {
  res.redirect("https://github.com/zulip/zulipbot");
});

// Parse JSON
app.use(bodyParser.json());

// Handle POST requests
app.post("/", function(req, res) {
  res.render("index"); // Send contents of index.ejs
  // check if event is for an issue opening or issue comment creation
  if (req.get("X-GitHub-Event").includes("issue") && req.body.action && (req.body.action === "opened" || "created")) issues(req.body);
});
