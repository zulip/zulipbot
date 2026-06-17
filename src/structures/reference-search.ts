import type { components } from "@octokit/openapi-types";
import { RequestError } from "@octokit/request-error";
import _ from "lodash";
import type { Client } from "../client.ts";

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
  /** The client that instantiated this template */
  client: Client;
  /** The number of the pull request this search applies to */
  number: number;
  /** The description of the pull request this search applies to */
  body: string;
  /** The name of the repository of the pull request this search applies to */
  repoName: string;
  /** The owner of the repository of the pull request this search applies to */
  repoOwner: string;

  constructor(
    client: Client,
    pull:
      | components["schemas"]["pull-request-simple"]
      | components["schemas"]["webhook-pull-request-synchronize"]["pull_request"]
      | components["schemas"]["pull-request-webhook"],
    repo: components["schemas"]["repository"],
  ) {
    this.client = client;
    this.number = pull.number;
    this.body = pull.body ?? "";
    this.repoName = repo.name;
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
   * @param strings Strings to find references in.
   * @returns Sorted array of all referenced issue numbers.
   */

  async find(strings: string[]) {
    const regex = new RegExp(
      `(?:${keywords.map((keyword) => _.escapeRegExp(keyword)).join("|")}):? #([0-9]+)`,
      "giv",
    );
    const issues = strings.flatMap((string) =>
      Array.from(string.matchAll(regex), (match) => Number(match[1])),
    );
    const uniqueIssues = [...new Set(issues)];

    // check matches for valid issue references
    const statusCheck = uniqueIssues.map(async (number) => {
      let issue;
      try {
        issue = await this.client.issues.get({
          owner: this.repoOwner,
          repo: this.repoName,
          issue_number: number,
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) return false;
        throw error;
      }

      // valid references are open issues
      const valid = !issue.data.pull_request && issue.data.state === "open";
      return valid ? number : false;
    });
    // statusCheck is an array of promises, so use Promise.all
    const matchStatuses = await Promise.all(statusCheck);
    // remove strings that didn't contain any references
    const filteredMatches = matchStatuses.filter((number) => number !== false);
    return filteredMatches.toSorted((a, b) => a - b);
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

export default ReferenceSearch;
