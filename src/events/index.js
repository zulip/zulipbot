"use strict";

const activity = require("./activity.js");
const issue = require("./issue.js");
const member = require("./member.js");
const pull = require("./pull.js");
const push = require("./push.js");
const travis = require("./travis.js");

module.exports = [activity, issue, member, pull, push, travis];
