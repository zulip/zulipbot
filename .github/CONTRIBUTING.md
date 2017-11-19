# CONTRIBUTING

## Getting started
Before you get started, make sure you have:

  * [installed](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
  and [configured](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)
  Git on your local machine

  * registered a [GitHub account](https://github.com/signup/free)

  * registered an account on the [Zulip development
  server](https://chat.zulip.org) and joined us on the [zulipbot
  stream](https://chat.zulip.org/#narrow/stream/zulipbot) on the Zulip
  development server, where most discussion concerning **zulipbot** takes place

  * read and followed our [Code of Conduct](CODE_OF_CONDUCT.md)
  as a contributor to create a more collaborative and welcoming environment
  for development

### Opening an issue
Are you trying to report a bug that you found in **zulipbot**? Do you have
suggestions for new features or improvements for **zulipbot**? These are all
great and valid reasons for opening an issue in our [GitHub issue
tracker](https://github.com/zulip/zulipbot/issues), where we maintain a list of
issues about **zulipbot** that need to be fixed. Please provide as much
information and details as you can in your issue so we can address your issue
properly.

  * If you're trying to report a bug, please describe the problem in depth with
  any accompanying screenshots or links to where the bug occurred; the more
  information that is given, the better we can diagnose the problem and fix it.

### Claiming an issue
If you see an issue in our issue tracker that you'd like to work on, please
claim it by commenting `@zulipbot claim` on the issue, and **@zulipbot** will
assign you to the issue so you can begin working on it.

### Installation

1. Open your command line interface (CLI).

2. Clone this repository to your local machine.

  ```sh
  $ git clone https://github.com/zulip/zulipbot.git
  ```

3. Switch to the local copy of this repository.

  ```sh
  $ cd ~/path-to-repo/zulipbot
  ```

4. Install the necessary node packages and dependencies.

  ```sh
  $ npm install
  ```

4. Run `tools/setup` to setup your local environment for **@zulipbot** development.

  ```sh
  $ tools/setup
  ```

5. Run the bot to ensure that your environment was configured correctly.

  ```sh
  $ npm start
  ```

If you encounter any problems during installation, let us know on the [zulipbot
chat](https://chat.zulip.org/#narrow/stream/zulipbot) and we can help you out!

## Making changes

1. Create a separate feature branch from the `master` branch for the changes you
plan to make.

2. Commit your changes, following Zulip's [commit discipline
practice](http://zulip.readthedocs.io/en/latest/contributing/version-control.html#commit-discipline).

3. Check if your changes and commits pass all tests:

  ```sh
  $ npm test
  ```

  Modify your commits accordingly if your changes don't pass all tests.

4. Fetch and rebase your changes against `upstream`:

  ```sh
  $ git fetch upstream
  ```

  Fix merge conflicts if necessary.

5. Push your changes to your fork on GitHub.

  ```sh
  $ git push origin feature-branch-name
  ```

  You may need to append `+` before your feature branch name if you failed to
  push some refs.

6. Create a [pull request](http://zulip.readthedocs.io/en/latest/contributing/git-guide.html#create-a-pull-request)
for the changes you made.

  * The **base fork** should be `zulip/zulipbot`.

  * The **base** should be `master`.

  * The **head fork** should be the name of your fork (ex: `octocat/zulipbot`).

  * The **compare** branch should be the name of your feature branch.

7. One of the project maintainers will review your pull request and merge it once
the pull request's Travis builds pass and any concerns about your pull request
are settled.

### Testing
**zulipbot** is currently manually tested on a separate
[organization](https://github.com/zulipbot-testing) and its repositories using a
[test account](https://github.com/zulipbot-test), **@zulipbot-test**, while a
framework for unit and coverage tests using [Mocha](https://mochajs.org) and
[Istanbul](https://github.com/gotwarlost/istanbul) is being established.

Our current test framework consists of [Travis](https://travis-ci.org/) for
continuous integration and [Gulp](http://gulpjs.com) (`./gulpfile.js`) for
running automated tests, such as reviewing code quality and consistency with
linters like [Eslint](http://eslint.org).

### Tools
To make contributing and testing easier, we've developed some tools to help you
with making changes:

  * `tools/newRepo` — Run this tool to create a new repository on the
  **zulipbot-testing** organization for your personal testing.

  * `tools/mockPayload` — Run this tool to send a mock payload to your
  repository on the **zulipbot-testing** organization to see how
  **@zulipbot-test** would respond to a certain payload according to the changes
  in your code once deployed.

  * `tools/checkInactivity` — Run this tool to see how **@zulipbot-test** would
  respond to open issues and pull requests on your repository on the
  **zulipbot-testing** organization when it checks for inactive issues and
  pull requests.

  * `tools/configLint` — Run this tool to see if **@zulipbot-test**'s
  configuration file `js/config.js` has been configured correctly.

  * `tools/fetchPriority` — Run this tool to generate a dry run report of all
  the issues labeled with the "priority" label (configured in `./src/config.js`)
  in the repositories that **@zulipbot** works in.

  * `tools/fetchInactive` — Run this tool to fetch all the inactive issues and
  pull requests in the `activeRepos` repositories configured in `./src/config.js`.

  **Warning:** This tool creates a large amount of API requests; please do not
  run this tool more than once an hour to prevent **@zulipbot-test** from being
  rate-limited.

## Additional resources

* [Zulip contributing guidelines](http://zulip.readthedocs.io/en/latest/overview/contributing.html)
* [Zulip Git guide](http://zulip.readthedocs.io/en/latest/contributing/git-guide.html)
* [Zulip version control guide](http://zulip.readthedocs.io/en/latest/contributing/version-control.html)
