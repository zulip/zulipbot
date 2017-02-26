# zulipbot

[![GitHub release](https://img.shields.io/github/release/zulip/zulipbot.svg)](https://github.com/zulip/zulipbot/releases/latest)
[![David](https://img.shields.io/david/zulip/zulipbot.svg)](https://github.com/zulip/zulipbot)
[![zulip chat](https://img.shields.io/badge/zulip-join_chat-brightgreen.svg)](https://chat.zulip.org)

[@zulipbot](https://github.com/zulipbot) is a GitHub workflow bot for the
[Zulip organization](https://zulip.org) and its repositories. Written in
Node.js, the bot handles issues in the repository in order to create a
better workflow for Zulip contributors.

**@zulipbot** is currently deployed on all repositories of the [Zulip
organization](https://zulip.org).

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
followed by the desired labels enclosed within double quotes (`""`).

    For example, to add the **bug** and **help wanted** labels to your
    issue, comment or include `@zulipbot label "bug" "help wanted"` in the
    issue body.

    You'll receive an error message if you try to add any labels to your issue
    that don't exist in your repository.

## Collaborate with zulipbot

1. Invite **@zulipbot** to
[collaborate](https://help.github.com/articles/inviting-collaborators-to-a-personal-repository/)
on your organization's repository.
2. Change **@zulipbot**'s permission level in the repository to **Admin**.
3. Finally, add the [**zulipbot** integration](https://github.com/integration/zulipbot)
to your repository.

## Contributing

If you wish to contribute to **@zulipbot**, please read our [contributing
guidelines](CONTRIBUTING.md) for more information and join us on the [zulipbot
topic](https://chat.zulip.org/#narrow/topic/zulipbot.20is.20alive!) on the Zulip
development server.

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
