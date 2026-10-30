import type { components } from "@octokit/openapi-types";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Bot } from "../bot.ts";

class Template {
  /**
   * The Bot that instantiated this template
   */
  bot: Bot;
  /**
   * The name of this template
   */
  name: string;
  /**
   * The content of this template
   */
  content: string;

  constructor(bot: Bot, name: string, content: string) {
    this.bot = bot;
    this.name = name;
    this.content = content;
  }

  /**
   * Finds comments generated from templates on a issue/pull request.
   *
   * @returns Array of filtered template comments from the bot user.
   */

  async getComments(
    parameters: RestEndpointMethodTypes["issues"]["listComments"]["parameters"],
  ) {
    const templateComments: Array<components["schemas"]["issue-comment"]> = [];

    for await (const response of this.bot.octokit.paginate.iterator(
      this.bot.octokit.issues.listComments,
      parameters,
    )) {
      for (const comment of response.data) {
        // Use end of template comments to check if comment is from template
        const matched = comment.body
          ?.trimEnd()
          .endsWith(`<!-- ${this.name} -->`);
        const isFromBot =
          comment.user !== null &&
          comment.user.login === this.bot.cfg.auth.username;
        if (matched && isFromBot) {
          templateComments.push(comment);
        }
      }
    }

    return templateComments;
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
