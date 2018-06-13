/**
 * Retrieves all pages of data from a node-github method.
 * @param {Object} page First page of data from the method.
 * @return {Array} Array of all data entries.
 */

exports.getAll = async function(page) {
  let response = page;
  let responses = response.data;
  while (this.hasNextPage(response)) {
    response = await this.getNextPage(response);
    responses = responses.concat(response.data);
  }
  return new Promise(resolve => resolve(responses));
};

/* eslint-disable array-element-newline */

const keywords = [
  "close", "closes", "closed",
  "fix", "fixes", "fixed",
  "resolve", "resolves", "resolved"
];

/* eslint-enable array-element-newline */

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
 * @param {Array} strings First page of data from the method.
 * @param {String} repoOwner Owner of the repository to search references for.
 * @param {String} repoName Name of the repository to search references for.
 * @return {Array} Sorted array of all referenced issues.
 */

exports.getReferences = async function(strings, repoOwner, repoName) {
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
    const issue = await this.issues.get({
      owner: repoOwner, repo: repoName, number: number
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
  const references = this.util.deduplicate(filteredMatches);
  return new Promise(resolve => resolve(references));
};

/**
 * Sorts and removes duplicate elements from a given array.
 *
 * @param {Array} array Array to remove duplicates from.
 * @return {Array} Sorted array containing only unique entries.
 */

exports.deduplicate = function(array) {
  return Array.from(new Set(array)).sort();
};
