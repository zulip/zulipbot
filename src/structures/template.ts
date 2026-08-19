import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Client } from "../client.ts";

type IssueComment =
  RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number];

class Template {
  /** The client that instantiated this template */
  client: Client;
  /** The name of this template */
  name: string;
  /** The content of this template */
  content: string;

  constructor(client: Client, name: string, content: string) {
    this.client = client;
    this.name = name;
    this.content = content;
  }

  matches(comment: IssueComment) {
    const marker = `<!-- ${this.name} -->`;
    const fromClient =
      comment.user !== null &&
      comment.user.login === this.client.cfg.auth.username;

    return comment.body?.trimEnd().endsWith(marker) === true && fromClient;
  }

  /**
   * Finds comments generated from templates on a issue/pull request.
   *
   * @returns Array of filtered template comments from the client user.
   */

  async getComments(
    parameters: RestEndpointMethodTypes["issues"]["listComments"]["parameters"],
  ) {
    const comments = await this.client.paginate(
      this.client.issues.listComments,
      parameters,
    );

    return comments.filter((comment) => this.matches(comment));
  }

  /**
   * Formats template content with values from a given context.
   *
   * @param context Context with names/values of variables to format
   * @returns Formatted template content.
   */

  format(context: Record<string, unknown>) {
    let content = this.content;
    for (const variable of Object.entries(context)) {
      const [expression, value] = variable;
      content = content.replaceAll(`{${expression}}`, () => String(value));
    }

    return content;
  }
}

export default Template;
