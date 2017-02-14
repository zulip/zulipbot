# zulipbot

[@zulipbot](https://github.com/zulipbot) is a GitHub workflow bot for the
[Zulip organization](https://zulip.org) and its repositories. Written in
Node.js, the bot handles issues in the repository in order to create a
better workflow for Zulip contributors.

**@zulipbot** is currently deployed on the [zulip-android](https://github.com/zulip/zulip-android) and [zulip-mobile](https://github.com/zulip/zulip-mobile) repositories.

## Usage

* **Claim an issue** — Comment "**@zulipbot** claim" on the issue you want
to claim; **@zulipbot** will assign you to the issue, label the issue as
**in progress**, and give you read-only collaborator access to the
repository, if necessary.

    You can also claim an issue that you've created by
including "**@zulipbot** claim" in the body of your issue.

## Installation

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
