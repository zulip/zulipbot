"use strict";
var path = require("path");
var gulp = require("gulp");
var eslint = require("gulp-eslint");
var excludeGitignore = require("gulp-exclude-gitignore");
var mocha = require("gulp-mocha");
var istanbul = require("gulp-istanbul");
var nsp = require("gulp-nsp");
var plumber = require("gulp-plumber");
var coveralls = require("gulp-coveralls");

gulp.task("static", () => {
  return gulp.src(["**/*.js", "tools/*", "!tools/setup"])
  .pipe(excludeGitignore())
  .pipe(eslint())
  .pipe(eslint.format())
  .pipe(eslint.failAfterError());
});

gulp.task("nsp", (cb) => {
  nsp({package: path.resolve("package.json")}, cb);
});

gulp.task("pre-test", () => {
  return gulp.src("src/**/*.js")
  .pipe(excludeGitignore())
  .pipe(istanbul({
    includeUntested: true
  }))
  .pipe(istanbul.hookRequire());
});

gulp.task("test", ["pre-test"], (cb) => {
  let mochaErr;

  gulp.src("test/**/*.js")
  .pipe(plumber())
  .pipe(mocha({reporter: "spec"}))
  .on("error", (err) => {
    mochaErr = err;
  })
  .pipe(istanbul.writeReports())
  .on("end", () => {
    cb(mochaErr);
  });
});

gulp.task("watch", () => {
  gulp.watch(["src/**/*.js", "test/**"], ["test"]);
});

gulp.task("coveralls", ["test"], () => {
  if (!process.env.CI) return;

  return gulp.src(path.join(__dirname, "coverage/lcov.info"))
  .pipe(coveralls());
});

gulp.task("prepublish", ["nsp"]);
gulp.task("default", ["static", "test", "coveralls"]); // ["static", "test", "coveralls"]
