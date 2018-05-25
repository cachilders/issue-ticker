module.exports = (issue) => {
  const {
    fields: {
      assignee: {
        displayName: assignee
      },
      created,
      description,
      issuetype: {
        name: issue_type
      },
      status: {
        name: status
      },
      summary,
      updated
    },
    id,
    key: ticket,
  } = issue;

  return {
    assignee,
    created,
    description,
    id,
    issue_type,
    status,
    summary,
    ticket,
    updated,
  };
};
