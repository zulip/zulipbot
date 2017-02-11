# zulipbot (work-in-progress)

[@zulipbot](https://github.com/zulipbot) is a GitHub workflow bot for the
[Zulip organization](https://zulip.org) and the
[zulip/zulip](https://github.com/zulip/zulip) repository. Written in Node.js
and deployed on Heroku, the bot handles issues in the repository in order to
create a better workflow for contributors.

The necessary functions for this bot, requested by
[@timabbott](https://github.com/timabbott), are:
* When someone wants to
claim an issue, they **@-mention** the bot in a comment on the issue, and the
bot then either assigns the issue to that person in the GitHub UI (if
possible) and adds a in-progress label to the issue.
* If the issue remains
open for a week without activity or a PR being opened, it posts a comment on
the issue and marks it as no-longer-in-progress (maybe after a day for the
person to say they're still working on it). *(unimplemented as of 02/11/17)*
* When someone claims an issue, it'd be really cool if we could add them as a
read-only collaborator on the repository before trying to assign the issue
to them, so that there isn't much setup work required
* We should have a configuration file that it reads the username/password from

## Installation

1. Open your command line interface (CLI).
2. Clone this repository to your local machine.

    ```sh
    $ git clone https://github.com/synicalsyntax/zulipbot.git
    ```

3. Switch to the local copy of this repository.

    ```sh
    $ cd ~/path-to-repo/zulipbot
    ```

4. Install the necessary node packages and dependencies.

    ```sh
    $ npm install
    ```

5. Create a file named `config.js` with **@zulipbot**'s login credentials.

    ```js
    module.exports = {
      username: 'zulipbot',
      password: // [REDACTED]
    }
    ```

5. Run the bot.

    ```sh
    $ npm start
    ```

6. Invite **@zulipbot** to collaborate on your organization's repository.
7. Change **@zulipbot**'s permission level in the repository to **Admin**.
8. Finally, add the [**zulipbot** integration](https://github.com/integration/zulipbot)
to your repository.

## Usage

To claim an issue on the repository, comment "**@zulipbot** claim-issue" on
the issue you want to claim, and **@zulipbot** will add the **in progress**
label and assign you as an assignee to the issue!
