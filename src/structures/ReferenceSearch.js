
/* eslint-disable array-element-newline */

const keywords = [
  "close", "closes", "closed",
  "fix", "fixes", "fixed",
  "resolve", "resolves", "resolved"
];

/* eslint-enable array-element-newline */

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
     * @type {Number}
     */
    this.body = pull.body;

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
    let matches = [];
    strings.forEach(string => {
      const wordMatches = keywords.map(tense => {
        const regex = new RegExp(`${tense}:? #([0-9]+)`, "i");
        const match = string.match(regex);
        return match ? match[1] : match;
      });
      matches = matches.concat(wordMatches);
    });
    // check matches for valid issue references
    const statusCheck = matches.map(async number => {
      if (!number) return false;
      const issue = await this.client.issues.get({
        owner: this.repoOwner, repo: this.repoName, number: number
      });
      // valid references are open issues
      const valid = !issue.data.pull_request && issue.data.state === "open";
      return valid ? number : false;
    });
    // statusCheck is an array of promises, so use Promise.all
    const matchStatuses = await Promise.all(statusCheck);
    // remove strings that didn't contain any references
    const filteredMatches = matchStatuses.filter(e => e);
    // sort and remove duplicate references
    const references = this.client.util.deduplicate(filteredMatches);
    return references;
  }

  async getBody() {
    const bodyRefs = await this.find([this.body]);
    return bodyRefs;
  }

  async getCommits() {
    const commits = await this.client.pullRequests.getCommits({
      owner: this.repoOwner, repo: this.repoName, number: this.number
    });

    const msgs = commits.data.map(c => c.commit.message);
    const commitRefs = await this.find(msgs);

    return commitRefs;
  }
}

module.exports = ReferenceSearch;
