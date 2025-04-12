export const run = async function (payload, commenter, args) {
  const creator = payload.issue.user.login;
  const self = this.cfg.issues.commands.label.self;
  const selfLabel = self.users ? !self.users.includes(commenter) : self;
  const forbidden = selfLabel && creator !== commenter;
  if (forbidden || !/".*?"/.test(args)) return;

  const repoName = payload.repository.name;
  const repoOwner = payload.repository.owner.login;
  const number = payload.issue.number;
  const issueLabels = new Set(payload.issue.labels.map((label) => label.name));

  const repoLabelArray = await this.util.getAllPages(
    "issues.listLabelsForRepo",
    {
      owner: repoOwner,
      repo: repoName,
    },
  );

  const repoLabels = new Set(repoLabelArray.map((label) => label.name));
  const labels = args
    .match(/".*?"/g)
    .map((string) => string.replaceAll('"', ""));

  // Get all specific area labels
  const specificLabels = labels.filter(
    (label) =>
      label.includes("area: ") && label.includes("(") && label.includes(")"),
  );

  const generalLabels = new Set();
  // Add general labels from every specific label
  for (const label of specificLabels) {
    generalLabels.add(label.slice(0, Math.max(0, label.indexOf(" ("))));
  }

  const alreadyAdded = labels.filter((label) => issueLabels.has(label));
  const rejected = labels.filter((label) => !repoLabels.has(label));

  // Add general lables to the input lables and filter
  const combinedLabels = new Set([...labels, ...generalLabels]);
  const addLabels = [...combinedLabels].filter(
    (label) => repoLabels.has(label) && !issueLabels.has(label),
  );

  const type = payload.issue.pull_request ? "pull request" : "issue";
  const template = this.templates.get("labelError");
  let response;

  if (rejected.length > 0) {
    const one = rejected.length === 1;
    const error = template.format({
      labels: `Label${one ? "" : "s"}`,
      type: type,
      labelList: `"${rejected.join('", "')}"`,
      exist: `do${one ? "es" : ""} not exist`,
      beState: `w${one ? "as" : "ere"}`,
      action: "added to",
    });

    await this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (alreadyAdded.length > 0) {
    const one = alreadyAdded.length === 1;
    const labels = alreadyAdded.join('", "');
    const error = template.format({
      labels: `Label${one ? "" : "s"}`,
      labelList: `"${labels}"`,
      exist: `already exist${one ? "s" : ""}`,
      beState: `w${one ? "as" : "ere"}`,
      action: "added to",
      type: type,
    });

    await this.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      body: error,
    });
  }

  if (addLabels.length > 0) {
    response = await this.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: number,
      labels: addLabels,
    });
  }

  return response;
};

export const aliasPath = "label.add";
