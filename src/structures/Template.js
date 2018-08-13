class Template {
  constructor(client, name, content) {
    /**
     * The client that instantiated this template
     * @type {Object}
     */
    this.client = client;

    /**
     * The name of this template
     * @type {string}
     */
    this.name = name;

    /**
     * The content of this template
     * @type {string}
     */
    this.content = content;
  }

  /**
   * Finds comments generated from templates on a issue/pull request.
   *
   * @param {Object} repo Repository object of the PR/issue.
   * @return {Array} Array of filtered template comments from the client user.
   */

  async getComments(parameters) {
    const method = "issues.getComments";
    const comments = await this.client.util.getAllPages(method, parameters);

    const templateComments = comments.filter(comment => {
      // Use end of template comments to check if comment is from template
      const matched = comment.body.endsWith(`<!-- ${this.name} -->`);
      const fromClient = comment.user.login === this.client.cfg.auth.username;
      return matched && fromClient;
    });

    return templateComments;
  }

  /**
   * Formats template content with values from a given context.
   *
   * @param {Object} context Context with names/values of variables to format
   * @return {String} Formatted template content.
   */

  format(context) {
    let content = this.content;
    for (const variable of Object.entries(context)) {
      const [expression, value] = variable;
      content = content.replace(new RegExp(`{${expression}}`, "g"), value);
    }
    return content;
  }
}

module.exports = Template;
