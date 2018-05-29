const request = require('request');
const {
  ALL_KEYS,
  JIRA_QUERY,
  PERSISTENT_KEYS,
  TIMEOUT,
} = require('../config/constants');
const {
  db,
  transactions,
} = require('../controllers/db');
const {compareIssues} = require('../helpers/issue-tools');
const processIssue = require('../helpers/issue-mapper');
const server = require('../controllers/socket-server');
const {
  JIRA_DOMAIN,
  JIRA_USERNAME,
  JIRA_PASSWORD,
} = process.env;

/* Very much a WIP */

const dropIssue = issue => db.none(`UPDATE tickets SET status = 'NO TRACK' WHERE id = $1`, [issue.id]);
const fetchStoredIssue = issue => db.one(`SELECT * FROM tickets WHERE id = $1 RETURNING *`, [issue.id]);
const fetchStoredIssues = () => db.any(`SELECT * FROM tickets WHERE status <> 'NO TRACK' ORDER BY updated DESC`);

const modelJiraIssues = (prevIssues) => {
  const httpRequestOptions = {
    url: `https://${JIRA_DOMAIN}/rest/api/latest/search?jql=${encodeURIComponent(JIRA_QUERY)}`,
    auth: {
      user: JIRA_USERNAME,
      pass: JIRA_PASSWORD
    }
  };
  request.get(httpRequestOptions, (error, res, body) => {
    if (error) {
      console.error(error);
    } else {
      const raw = JSON.parse(body).issues;
      const issues = raw ? raw.map(processIssue) : [];
      transactions(t => {
        const queries = issues.map(issue => {
          const all = ALL_KEYS;
          const staticValues = PERSISTENT_KEYS;
          const update = all.filter(prop => !staticValues.includes(prop));
          const makeVal = prop => `\${${prop}}`;
          const assignVal = prop => `${prop} = ${makeVal(prop)}`;
          return t.oneOrNone(
            `INSERT INTO tickets(${all.join(', ')})
            VALUES(${all.map(makeVal).join(', ')})
            ON CONFLICT (id) DO UPDATE SET ${update.map(assignVal).join(', ')}
            RETURNING *`, issue
          );
        });
        return t.batch(queries);
      })
        .then(nextIssues => {
          /**
           * This is MVP print stuff. TODO: Expand to a print view that trims
           * and formats description and tells what has changed in updated
           * tickets. Probably need to add story points to the table.
           */
          const {added, dropped, updated} = compareIssues(prevIssues, issues);
          added.forEach(issue => server.broadcast(
            `ASSIGNED: ${issue.ticket}`
          ));
          updated.forEach(issue => server.broadcast(
            `UPDATED: ${issue.ticket}`
          ));
          dropped.forEach(issue => {
            server.broadcast(
              `UNASSIGNED: ${issue.ticket}`
            );
            dropIssue(issue);
          });
          setTimeout(modelJiraIssues.bind(null, nextIssues), TIMEOUT);
        })
        .catch(console.error);
    }
  });
};

module.exports = {
  fetchStoredIssue,
  fetchStoredIssues,
  modelJiraIssues,
};
