const path = require("path");
const gulp = require("gulp");
const eslint = require("gulp-eslint");
const excludeGitignore = require("gulp-exclude-gitignore");
const nsp = require("gulp-nsp");

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

gulp.task("prepublish", ["nsp"]);
gulp.task("default", ["static"]); // ["static", "test", "coveralls"]
