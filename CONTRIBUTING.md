# CONTRIBUTING

Please read the [Zulip contributing guidelines](http://zulip.readthedocs.io/en/latest/readme-symlink.html).

## Development

**@zulipbot** is currently manually tested on a
separate [organization](https://github.com/zulipbot-testing) and its
repositories using a [test account](https://github.com/zulipbot-test),
**@zulipbot-test**.

### Dependencies

[![David](https://img.shields.io/david/zulip/zulipbot.svg)](https://david-dm.org/zulip/zulipbot)

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

5. Create a file named `config.js` in the `src` folder with
**@zulipbot-test**'s login credentials.

    ```js
    module.exports = {
      username: 'zulipbot-test',
      password: // [REDACTED; please contact @synicalsyntax for password]
    }
    ```

6. Run the bot.

    ```sh
    $ npm start
    ```

### Testing

[Travis](https://travis-ci.org/) is used for continuous integration and
[Gulp](http://gulpjs.com) (`gulpfile.js`) is used to run automated tests, such
as reviewing code quality and consistency with linters like
[Eslint](http://eslint.org). Currently, a framework for unit and coverage tests
using [Mocha](https://mochajs.org) and
[Istanbul](https://github.com/gotwarlost/istanbul) is being established.

To run all tests, use the following command:

```sh
$ npm test
```

Pull requests will only be merged after their Travis builds pass.
