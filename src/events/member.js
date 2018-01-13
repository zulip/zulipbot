exports.run = async function(payload) {
  const claimEnabled = this.cfg.issues.commands.assign.claim.length;

  if (payload.action !== "added" || !claimEnabled) return;

  const newMember = payload.member.login;
  const invite = this.invites.get(newMember);

  if (!invite) return;

  const repo = payload.repository;
  const repoFullName = invite.split("#")[0];

  if (repoFullName !== repo.full_name) return;

  const number = invite.split("#")[1];
  const repoOwner = repoFullName.split("/")[0];
  const repoName = repoFullName.split("/")[1];

  const response = await this.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: number, assignees: [newMember]
  });

  if (response.data.assignees.length) return;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  this.issues.createComment({
    owner: repoOwner, repo: repoName, number: number, body: error
  });
};

exports.events = ["member"];
