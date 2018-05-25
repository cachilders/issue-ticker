const request = require('request');
const {
  allKeys,
  persistentKeys,
  timeout,
} = require('../config/constants');
const {
  dropIssue,
  transactions,
} = require('./db');
const {
  compareIssues,
  prettify,
} = require('../helpers/issue-tools');
const processIssue = require('../helpers/issue-mapper');
const {
  JIRA_DOMAIN,
  JIRA_QUERY,
  JIRA_USERNAME,
  JIRA_PASSWORD,
} = process.env;


const fetchJiraIssues = (prevIssues) => {
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
          const all = allKeys;
          const staticValues = persistentKeys;
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
          const {added, dropped, updated} = compareIssues(prevIssues, issues);
          added.forEach(issue => console.log(`ASSIGNED: ${prettify(issue)}`));
          updated.forEach(issue => console.log(`UPDATED: ${prettify(issue)}`));
          dropped.forEach(issue => {
            console.log(`UNASSIGNED: ${prettify(issue)}`);
            dropIssue(issue);
          });
          setTimeout(fetchJiraIssues.bind(null, nextIssues), timeout);
        })
        .catch(console.error);
    }
  });
};

module.exports = { fetchJiraIssues }
