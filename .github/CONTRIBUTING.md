# CONTRIBUTING

## Getting started
Before you get started, make sure you have:

  * [installed](https://github.com/zulip/zulipbot/wiki/Installation) a local
    copy of **zulipbot**

  * registered an account on the [Zulip development
    server](https://chat.zulip.org) and joined us on the [zulipbot
    stream](https://chat.zulip.org/#narrow/stream/zulipbot) on the Zulip
    development server, where most discussion concerning **zulipbot** takes
    place

  * read and followed our [Code of Conduct](CODE_OF_CONDUCT.md) as a contributor
    to create a more collaborative and welcoming environment for development

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
    information that is given, the better we can diagnose the problem and fix
    it.

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
  $ yarn install
  ```

5. Use the [smee.io](https://smee.io/) CLI to redirect GitHub webhook payloads
   to your locally running application.

  ```sh
  $ smee -u https://smee.io/yourcustomurl -P /github -p 8080
  ```

6. Create a [GitHub user
   account](https://help.github.com/articles/signing-up-for-a-new-github-account/)
   and a [GitHub
   App](https://developer.github.com/apps/building-github-apps/creating-a-github-app/)
   to test with.
  * See
    [here](https://github.com/zulip/zulipbot/wiki/Configuration#authentication)
    to check how to authenticate your user account.
  * The **Webhook URL** in your GitHub App settings should be
    `https://smee.io/yourcustomurl`.

7. Run the bot to ensure that your environment was configured correctly.

  ```sh
  $ yarn start
  ```

If you encounter any problems during installation, let us know on the [zulipbot
chat](https://chat.zulip.org/#narrow/stream/zulipbot) and we can help you out!

## Making changes

1. Create a separate feature branch from the `master` branch for the changes you
   plan to make.

2. Commit your changes, following Zulip's [commit discipline
   practice](https://zulip.readthedocs.io/en/latest/contributing/version-control.html#commit-discipline).

3. Check if your changes and commits pass all tests:

  ```sh
  $ yarn test
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

6. Create a [pull
   request](https://zulip.readthedocs.io/en/latest/git/pull-requests.html#create-a-pull-request)
   for the changes you made.

  * The **base fork** should be `zulip/zulipbot`.

  * The **base** should be `master`.

  * The **head fork** should be the name of your fork (ex: `octocat/zulipbot`).

  * The **compare** branch should be the name of your feature branch.

7. One of the project maintainers will review your pull request and merge it
   once the pull request's Travis builds pass and any concerns about your pull
   request are settled.

### Testing
**zulipbot** is currently manually tested on private repositories and user
accounts while a test suite is being established. Webhook payloads can be
delivered to a locally running application using [Smee](https://smee.io/).

Our current test suite consists of [Travis](https://travis-ci.org/) for
continuous integration, and we review code quality and consistency with the
[Eslint](https://eslint.org) linter.

## Additional resources

* [Zulip contributing
  guidelines](https://zulip.readthedocs.io/en/latest/overview/contributing.html)
* [Zulip Git
  guide](https://zulip.readthedocs.io/en/latest/contributing/git-guide.html)
* [Zulip version control
  guide](https://zulip.readthedocs.io/en/latest/contributing/version-control.html)
