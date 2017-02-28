"use strict"; // catch errors easier

// requirements
const express = require("express");
const bodyParser = require("body-parser");
const issues = require("./issues.js");

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

// handle POST requests
app.post("/", function(req, res) {
  res.render("index"); // Send contents of index.ejs
  // check if event is for an issue opening or issue comment creation
  if (req.get("X-GitHub-Event").includes("issue") && req.body.action && (req.body.action === "opened" || "created")) {
    issues(req.body); // send parsed payload to issues.js
  }
});
