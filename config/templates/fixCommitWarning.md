Hello @{author}, it seems like you have referenced an issue in your pull request, but you have not referenced that issue in your commit message(s). When you reference an issue in a commit message, it automatically closes the corresponding issue when the commit is merged.

Please run `git commit --amend` in your command line client to amend your commit message description with `"Fixes #{issue number}”`.

An example of a correctly-formatted commit:
```
commit fabd5e450374c8dde65ec35f02140383940fe146
Author: zulipbot
Date:   Sat Mar 18 13:42:40 2017 -0700

    pull requests: Check PR commits reference when issue is referenced.

    Fixes #51
```

Thank you for your contributions to Zulip!

<!-- fixCommitWarning -->