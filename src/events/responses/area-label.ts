import type { components } from "@octokit/openapi-types";
import { assertDefined } from "ts-extras";

import type { Client } from "../../client.ts";

const referenced: string[] = [];

export const run = async function (
  this: Client,
  issue:
    | components["schemas"]["issue"]
    | components["schemas"]["webhooks_issue"],
  repo: components["schemas"]["repository-webhooks"],
  label: components["schemas"]["webhooks_label"],
) {
  const areaLabel = label.name;
  const number = issue.number;
  const repoName = repo.name;
  const repoOwner = repo.owner.login;
  assertDefined(issue.labels);
  const issueLabels = issue.labels.map((l) =>
    typeof l === "string" ? l : l.name,
  );
  const areaLabels = this.cfg.issues.area.labels;

  if (areaLabels && !areaLabels.has(areaLabel)) return;

  const issueAreaLabels = issueLabels
    .filter((l) => l !== undefined)
    .filter((l) => areaLabels?.has(l));
  const labelTeams = issueAreaLabels.map((l) => areaLabels!.get(l)!);

  // Create unique array of teams (labels can point to same team)
  const uniqueTeams = [...new Set(labelTeams)].toSorted();

  const areaTeams = `@${repoOwner}/${uniqueTeams.join(`, @${repoOwner}/`)}`;
  const references = issueAreaLabels.join('", "');

  const payload = issue.pull_request ? "pull request" : "issue";
  const labelSize = labelTeams.length === 1 ? "label" : "labels";
  const template = this.templates.get("areaLabelAddition");
  assertDefined(template);

  const comment = template.format({
    teams: areaTeams,
    refs: `"${references}"`,
    labels: labelSize,
    payload: payload,
  });

  const comments = await template.getComments({
    owner: repoOwner,
    repo: repoName,
    issue_number: number,
  });

  const tag = `${repoOwner}/${repoName}#${number}`;

  if (comments[0] !== undefined) {
    const id = comments[0].id;
    if (issueAreaLabels.length > 0) {
      void this.issues.updateComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: id,
        body: comment,
      });
    } else {
      void this.issues.deleteComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: id,
      });
    }
  } else if (!referenced.includes(tag) && issueAreaLabels.length > 0) {
    void this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: comment,
    });

    // Ignore labels added in bulk
    referenced.push(tag);
    setTimeout(() => {
      referenced.splice(referenced.indexOf(tag), 1);
    }, 1000);
  }
};
