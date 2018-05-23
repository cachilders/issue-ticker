require('dotenv').config();

const bodyParser = require('body-parser');
const db = require('./db');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const request= require('request');
const { JIRA_DOMAIN,
  JIRA_QUERY,
  JIRA_USERNAME,
  JIRA_PASSWORD,
  PORT
} = process.env;

app.use(bodyParser.json());
      
setInterval(() => {
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
      const issues = raw ? JSON.parse(body).issues.map(processIssue) : [];
      console.log(issues);
    }
  });
}, 1000);

function processIssue(issue) {
  const {
    fields: {
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
    key,
  } = issue;

  return {
    created,
    description,
    id,
    issue_type,
    key,
    status,
    summary,
    updated,
  }
}

let port = PORT || 8080;
http.listen(port, function(){});
