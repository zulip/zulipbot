exports.run = (client, payload) => {
  if (payload.action !== "added" || !client.cfg.claimCommands.length) return;
  const newMember = payload.member.login;
  const invite = client.invites.get(newMember);
  if (!invite) return;
  const repo = payload.repository;
  const repoFullName = invite.split("#")[0];
  if (repoFullName !== repo.full_name) return;
  const number = invite.split("#")[1];
  client.issues.addAssigneesToIssue({
    owner: repoFullName.split("/")[0], repo: repoFullName.split("/")[1], number: number, assignees: [newMember]
  }).then((response) => {
    if (response.data.assignees) return;
    client.newComment({number: number}, repo, "**ERROR:** Issue claiming failed (no assignee was added).");
  });
};

exports.events = ["member"];
