module.exports = {
  ALL_KEYS: ['assignee', 'created', 'description', 'id', 'issue_type', 'status', 'summary', 'ticket', 'updated'],
  JIRA_QUERY: 'status not in (Closed, Cancelled, Done, Released) AND assignee = currentuser() ORDER BY updated',
  PERSISTENT_KEYS: ['created', 'id', 'ticket'],
  PORT: 8080,
  SOCKET_PORT: 5001,
  TIMEOUT: 5 * 60 * 1000,
};
