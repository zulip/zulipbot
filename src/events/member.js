exports.run = async function(payload) {
  const claimEnabled = this.cfg.issues.commands.assign.claim.length;

  if (payload.action !== "added" || !claimEnabled) return;

  const member = payload.member.login;
  const repoFullName = payload.repository.full_name;
  const invite = this.invites.get(`${member}@${repoFullName}`);

  if (!invite) return;

  const [repoOwner, repoName] = repoFullName.split("/");

  const response = await this.issues.addAssignees({
    owner: repoOwner, repo: repoName, number: invite, assignees: [member]
  });

  this.invites.delete(`${member}@${repoFullName}`);

  if (response.data.assignees.length) return true;

  const error = "**ERROR:** Issue claiming failed (no assignee was added).";
  return this.issues.createComment({
    owner: repoOwner, repo: repoName, number: invite, body: error
  });
};

exports.events = ["member"];
