## CONTRIBUTING (work-in-progress)

## Development

**@zulipbot** is currently tested on a separate
[organization](https://github.com/zulipbot-testing) and its repositories using a
[test account](https://github.com/zulipbot-testing), **@zulipbot-testing**.

Unit tests using [Nock](https://github.com/node-nock/nock) are currently being
written.

### Dependencies

* node = v7.4.0
* npm >= 4.0.5
* github = 8.2.1
* body-parser = 1.16.0
* express = 4.14.0
* ejs = 2.5.5
* request = 2.79.0

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

5. Create a file named `config.js` in the `src` folder with **@zulipbot**'s login credentials.

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
