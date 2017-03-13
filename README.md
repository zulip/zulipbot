# zulipbot
test
[![Build Status](https://travis-ci.org/zulip/zulipbot.svg?branch=master)](https://travis-ci.org/zulip/zulipbot)
[![David](https://img.shields.io/david/zulip/zulipbot.svg)](https://david-dm.org/zulip/zulipbot)
[![GitHub release](https://img.shields.io/github/release/zulip/zulipbot.svg)](https://github.com/zulip/zulipbot/releases/latest)
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

    * If you're a new contributor, **@zulipbot** will give you read-only
    collaborator access to the repository and leave a welcome message on the
    issue you claimed.

    * You can also claim an issue that you've opened by including
    `@zulipbot claim` in the body of your issue.

    * If you accidentally claim an issue you didn't want to claim, comment
    `@zulipbot abandon` to abandon an issue.

* **Label your issues** — Add appropriate labels to issues that you opened by
including`@zulipbot label` in an issue comment or the body of your issue
followed by the desired labels enclosed within double quotes (`""`).

    * For example, to add the **bug** and **help wanted** labels to your
    issue, comment or include `@zulipbot label "bug" "help wanted"` in the
    issue body.

    * You'll receive an error message if you try to add any labels to your issue
    that don't exist in your repository.

    * If you accidentally added the wrong labels, you can remove them by commenting
    `@zulipbot remove` followed by the desired labels enclosed with double quotes
    (`""`).

* **Find unclaimed issues** - Use the [GitHub search
feature](https://help.github.com/articles/using-search-to-filter-issues-and-pull-requests/)
to find unclaimed issues by adding one of the following filters to your search:

    * `-label: "in progress"` (excludes issues labeled with the **in progress** label)

    * `no:assignee` (shows issues without assignees)

    Issues labeled with the **in progress** label and/or assigned to other users have
    already been claimed.

* **Collaborate in area label teams** - Receive notifications on issues and
pull requests within your fields of expertise on the
[Zulip server repository](https://github.com/zulip/zulip) by joining the Zulip server
[area label teams](https://github.com/orgs/zulip/teams?utf8=✓&query=Server). These teams
correspond to the repository's [area labels](https://github.com/zulip/zulip/labels),
although some teams are associated with multiple labels; for example, the **area:
message-editing** and **area: message view** labels are both related to the
[Server message view](https://github.com/orgs/zulip/teams/server-message-view) team.
Feel free to join as many area label teams as as you'd like!

    After your request to join an area label team is approved, you'll receive
    notifications for any issues labeled with the team's corresponding area
    label as well as any pull requests that reference issues labeled with your
    team's area label.

## Collaborate with zulipbot

1. Invite **@zulipbot** to
[collaborate](https://help.github.com/articles/inviting-collaborators-to-a-personal-repository/)
on your organization's repository.
2. Change **@zulipbot**'s permission level in the repository to **Admin**.
3. Finally, add the [**zulipbot** integration](https://github.com/integration/zulipbot)
to your repository.

## Contributing

If you wish to contribute to **@zulipbot**, please read our [contributing
guidelines](CONTRIBUTING.md) for more information.

## License

Copyright (c) 2017 Cynthia Lin, Joshua Pan, and contributors

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
