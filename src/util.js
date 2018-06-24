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

/*
  Keywords from https://help.github.com/articles/closing-issues-using-keywords/
  Referenced issues are only closed when pull requests are merged;
  not necessarily when commits are merged
*/
exports.findKeywords = string => {
  const keywords = ["close", "fix", "resolve"];

  return keywords.some(word => {
    const current = word;
    const past = word.endsWith("e") ? `${word}d` : `${word}ed`;
    const present = word.endsWith("e") ? `${word}s` : `${word}es`;
    const tenses = [current, past, present];

    const matched = tenses.some(t => {
      const regex = new RegExp(`${t}:? #([0-9]+)`, "i");
      return string.match(regex);
    });

    return matched;
  });
};

exports.getReferences = async function(number, repoOwner, repoName) {
  const response = await this.pullRequests.getCommits({
    owner: repoOwner,
    repo: repoName,
    number: number
  });

  const refIssues = response.data.filter(c => {
    return exports.findKeywords(c.commit.message);
  }).map(c => c.commit.message.match(/#([0-9]+)/)[1]);

  return new Promise(resolve => resolve(Array.from(new Set(refIssues))));
};
