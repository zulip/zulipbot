# zulipbot

[![Build Status](https://travis-ci.org/zulip/zulipbot.svg?branch=master)](https://travis-ci.org/zulip/zulipbot)
[![David](https://img.shields.io/david/zulip/zulipbot.svg)](https://david-dm.org/zulip/zulipbot)
[![GitHub release](https://img.shields.io/github/release/zulip/zulipbot.svg)](https://github.com/zulip/zulipbot/releases/latest)
[![GitHub license](https://img.shields.io/badge/license-Apache%202-blue.svg)](https://github.com/zulip/zulipbot/blob/master/LICENSE.md)
[![zulipbot chat](https://img.shields.io/badge/chat-zulip-2c7c6e.svg)](https://chat.zulip.org/#narrow/stream/zulipbot)

[@zulipbot](https://github.com/zulipbot) is a GitHub workflow bot application
for the [Zulip organization](https://zulip.org) and its repositories. Written in
Node.js, the bot manages issues and pull requests in the repository in order to
create a better workflow for Zulip contributors.

**zulipbot**'s purpose is to work around various limitations in GitHub’s binary
permissions and notifications systems to create a better workflow for our
contributors. It allows anyone to perform issue triage (self-assigning and
labeling issues), not just the core contributors trusted with full write access
to the repository (which is the only model GitHub supports). Additionally,
**zulipbot** monitors the activity of issues and pull requests, notifying
contributors about new merge conflicts, continuous integration build results,
inactivity, and more.

## Installation

To install a copy of **zulipbot** on your own GitHub repository, please visit
the [Installation](https://github.com/zulip/zulipbot/wiki/Installation) page on
the **zulipbot wiki**.

## Usage

If you're using the [Zulip project
configuration](https://github.com/zulip/zulipbot/blob/master/src/zulip_project_config.js)
(`./config/config-example.js`), see zulipbot's [usage
instructions](https://zulip.readthedocs.io/en/latest/contributing/zulipbot-usage.html)
on the Zulip documentation.

If you're using your own custom configuration (`./config/config.js` is different
from the Zulip project configuration), please visit the
[Commands](https://github.com/zulip/zulipbot/wiki/Commands) page on the
**zulipbot wiki**.

## Contributing

If you wish to contribute to **zulipbot**, please read our [contributing
guidelines](CONTRIBUTING.md) for more information.

## License

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy
of the License at

```
https://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.

The software includes some works released by third parties under other free
and open source licenses. Those works are redistributed under the license
terms under which the works were received.
