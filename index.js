require('dotenv').config();

const bodyParser = require('body-parser');
const db = require('./db');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const R = require('ramda');
const request = require('request');
const timeout = 5 * 60 * 1000;
const { JIRA_DOMAIN,
  JIRA_QUERY,
  JIRA_USERNAME,
  JIRA_PASSWORD,
  PORT
} = process.env;

app.use(bodyParser.json());

app.get('/api/fetch_issues', (req, res) => {
  fetchStoredIssues()
    .then(data => res.send(data))
    .catch(error => res.send(error));
});
      
function fetchJiraIssues(prevIssues) {
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
        const quantMatch = nextIssues.length === prevIssues.length;
        const leftMatch = nextIssues[0] && nextIssues.id === prevIssues.id && nextIssues.updated === prevIssues.updated;
        let add, drop, lastUpdate;
        
        function recent(updatedAt) { return new Date(updatedAt) > lastUpdate };

        if (quantMatch && leftMatch) {
          console.log('No changes');
        } else {
          lastUpdate = prevIssues[0] && new Date(prevIssues[0].updated);
          drop = R.difference(prevIssues, nextIssues);
          updated = nextIssues.filter(issue => recent(issue.updated));
          if (drop.length) {
            console.log('Freshly unassigned or closed: ', drop);
          }
          if (updated.length) {
            console.log('Freshly updated: ', updated);
          }
        }

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

function fetchStoredIssues() {
  return db.any(`SELECT * FROM tickets ORDER BY updated DESC`);
}

fetchStoredIssues().then(fetchJiraIssues).catch(console.error)

let port = PORT || 8080;
http.listen(port, function(){});
