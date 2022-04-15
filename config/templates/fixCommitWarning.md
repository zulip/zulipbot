Hello @{author}, it seems like you have referenced #{issues} in your pull request description, but you have not referenced {issuePronoun} in your commit message description(s). Referencing an issue in a commit message automatically closes the corresponding issue when the commit is merged, which makes the issue tracker easier to manage.

Please run `git commit --amend` in your command line client to amend your commit message description with `Fixes #{fixIssues}.`.

An example of a correctly-formatted commit:

```
commit fabd5e450374c8dde65ec35f02140383940fe146
Author: zulipbot
Date:   Sat Mar 18 13:42:40 2017 -0700

    pull requests: Check PR commits reference when issue is referenced.

    Fixes #51.
```

To learn how to write a great commit message, please refer to our [guide](https://zulip.readthedocs.io/en/latest/contributing/version-control.html#commit-messages).

<!-- fixCommitWarning -->
