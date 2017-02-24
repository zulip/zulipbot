# zulipbot

[@zulipbot](https://github.com/zulipbot) is a GitHub workflow bot for the
[Zulip organization](https://zulip.org) and its repositories. Written in
Node.js, the bot handles issues in the repository in order to create a
better workflow for Zulip contributors.

**@zulipbot** is currently deployed on the
[zulip-android](https://github.com/zulip/zulip-android),
[zulip-mobile](https://github.com/zulip/zulip-mobile),
[zulip-desktop](https://github.com/zulip/zulip-desktop), and
[zulip](https://github.com/zulip/zulip) repositories.

## Usage

* **Claim an issue** — Comment `@zulipbot claim` on the issue you want
to claim; **@zulipbot** will assign you to the issue and label the issue as
**in progress**.

    If you're a new contributor, **@zulipbot** will give you read-only
    collaborator access to the repository and leave a welcome message on the
    issue you claimed.

    You can also claim an issue that you've opened by including
    "**@zulipbot** claim" in the body of your issue.

* **Label your issues** — Add appropriate labels to issues that you opened by
including`@zulipbot label` in an issue comment or the body of your issue
followed by the desired labels enclosed within double quotes ("").

    For example, to add the **bug** and **help wanted** labels to your
    issue, comment or include `@zulipbot label "bug" "help wanted"` in the
    issue body.

    You'll receive an error message if you try to add any labels to your issue that don't exist in your repository.

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

## License

Copyright (c) 2016 Dropbox, Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy
of the License at

```
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.

The software includes some works released by third parties under other free
and open source licenses. Those works are redistributed under the license
terms under which the works were received.
