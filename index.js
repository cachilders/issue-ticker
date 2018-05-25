require('dotenv').config();

const bodyParser = require('body-parser');
const db = require('./db');
const express = require('express');
const app = express();
const R = require('ramda');
const request = require('request');
const { JIRA_DOMAIN,
  JIRA_QUERY,
  JIRA_USERNAME,
  JIRA_PASSWORD,
  PORT
} = process.env;
const timeout = 60 * 1000;
const port = PORT || 8080;

app.use(bodyParser.json());

app.get('/api/fetch_issues', (req, res) => {
  fetchStoredIssues()
    .then(data => res.send(data))
    .catch(error => res.send(error));
});

const fetchStoredIssues = () => db.any(`SELECT * FROM tickets WHERE status <> 'NO TRACK' ORDER BY updated DESC`);
const fetchStoredIssue = issue => db.one(`SELECT * FROM tickets WHERE id = $1 RETURNING *`, [issue.id]);
const dropIssue = issue => db.none(`UPDATE tickets SET status = 'NO TRACK' WHERE id = $1`, [issue.id]);

const recent = (itemUpdated, lastUpdated) => new Date(itemUpdated) > lastUpdated;
const prettify = issue => JSON.stringify(issue, null, 2);

const compareIssues = (prev, next) => {
  const lastUpdated = prev[0] && new Date(prev[0].updated);
  const makeReference = R.indexBy(R.prop('id'));
  const prevReference = makeReference(prev);
  const nextReference = makeReference(next);

  const getLatest = issues => issues.filter(issue => recent(issue.updated, lastUpdated));
  const persistant = issue => !!nextReference[issue.id];
  const preexisting = issue => !!prevReference[issue.id];

  const {0: updated, 1: added} = R.partition(preexisting, getLatest(next));
  const dropped = R.reject(persistant, prev);
  
  return {added, dropped, updated}
}
      
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
      db.tx(t => {
        const queries = issues.map(issue => {
          const all = ['assignee', 'created', 'description', 'id', 'issue_type', 'status', 'summary', 'ticket', 'updated'];
          const static = ['created', 'id', 'ticket'];
          const update = all.filter(prop => !static.includes(prop));
          const makeVal = prop => `\${${prop}}`;
          const assignVal = prop => `${prop} = ${makeVal(prop)}`;
          return t.oneOrNone(
            `INSERT INTO tickets(${all.join(', ')})
            VALUES(${all.map(makeVal).join(', ')})
            ON CONFLICT (id) DO UPDATE SET ${update.map(assignVal).join(', ')}
            RETURNING *`,
          issue);
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

function processIssue(issue) {
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
}

fetchStoredIssues().then(fetchJiraIssues).catch(console.error)

app.listen(port, function(){});
