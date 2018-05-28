const request = require('request');
const {
  ALL_KEYS,
  PERSISTENT_KEYS,
  TIMEOUT,
} = require('../config/constants');
const {
  db,
  transactions,
} = require('../controllers/db');
const {
  compareIssues,
  prettify,
} = require('../helpers/issue-tools');
const processIssue = require('../helpers/issue-mapper');
const server = require('../controllers/socket-server');
const {
  JIRA_DOMAIN,
  JIRA_QUERY,
  JIRA_USERNAME,
  JIRA_PASSWORD,
} = process.env;


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
          // TODO: Decouple this biz into a more structured printer output view json
          const {added, dropped, updated} = compareIssues(prevIssues, issues);
          added.forEach(issue => server.broadcast(`ASSIGNED: ${prettify(issue)}`));
          updated.forEach(issue => server.broadcast(`UPDATED: ${prettify(issue)}`));
          dropped.forEach(issue => {
            server.broadcast(`UNASSIGNED: ${prettify(issue)}`);
            dropIssue(issue);
          });
          // TODO: Repeat. Decouple this biz.
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
