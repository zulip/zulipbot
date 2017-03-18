Hello @[author], it seems like you have referenced an issue in your pull request, but you have not referenced that issue in your commit message(s). When you reference an issue in a commit message, it closes the corresponding issue for Zulip maintainers once your commit is merged.

Please run `git commit --amend` in your command line client to amend your commit message description with `"Fixes #[issue number]”`.

An example of a correctly-formatted commit:
```
commit 877c29919d88fae3a995389c3f80a3be6a4dc8f4
Author: zulipbot
Date:   Sat Mar 18 13:15:26 2017 -0700

    Check PR commits reference when issue referenced.

    Fixes #51.
```

Thank you for your understanding and you valuable contributions to Zulip!
