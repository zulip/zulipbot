"use strict";

const _ = require("lodash");

const keywords = [
  "close",
  "closes",
  "closed",
  "fix",
  "fixes",
  "fixed",
  "resolve",
  "resolves",
  "resolved",
];

class ReferenceSearch {
  constructor(client, pull, repo) {
    /**
     * The client that instantiated this template
     * @type {Object}
     */
    this.client = client;

    /**
     * The number of the pull request this search applies to
     * @type {Number}
     */
    this.number = pull.number;

    /**
     * The description of the pull request this search applies to
     * @type {String}
     */
    this.body = pull.body || "";

    /**
     * The name of the repository of the pull request this search applies to
     * @type {Object}
     */
    this.repoName = repo.name;

    /**
     * The owner of the repository of the pull request this search applies to
     * @type {Object}
     */
    this.repoOwner = repo.owner.login;
  }

  /**
   * Finds all open referenced issues from a given string
   * by identifying keywords specified above.
   *
   * Keywords are sourced from
   * https://help.github.com/articles/closing-issues-using-keywords/
   *
   * Referenced issues are only closed when pull requests are merged,
   * not necessarily when commits are merged.
   *
   * @param {Array} strings Strings to find references in.
   * @return {Array} Sorted array of all referenced issue numbers.
   */

  async find(strings) {
    const matches = strings.flatMap((string) =>
      keywords.map((tense) => {
        const regex = new RegExp(`${_.escapeRegExp(tense)}:? #([0-9]+)`, "i");
        const match = string.match(regex);
        return match ? match[1] : match;
      })
    );

    // check matches for valid issue references
    const statusCheck = matches.map(async (number) => {
      if (!number) return false;
      const issue = await this.client.issues.get({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: number,
      });
      // valid references are open issues
      const valid = !issue.data.pull_request && issue.data.state === "open";
      return valid ? number : false;
    });
    // statusCheck is an array of promises, so use Promise.all
    const matchStatuses = await Promise.all(statusCheck);
    // remove strings that didn't contain any references
    const filteredMatches = matchStatuses.filter(Boolean);
    // sort and remove duplicate references
    const references = this.client.util.deduplicate(filteredMatches);
    return references;
  }

  async getBody() {
    const bodyReferences = await this.find([this.body]);
    return bodyReferences;
  }

  async getCommits() {
    const commits = await this.client.pulls.listCommits({
      owner: this.repoOwner,
      repo: this.repoName,
      pull_number: this.number,
    });

    const msgs = commits.data.map((c) => c.commit.message);
    const commitReferences = await this.find(msgs);

    return commitReferences;
  }
}

module.exports = ReferenceSearch;
