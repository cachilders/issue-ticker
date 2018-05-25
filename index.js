require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const api = require('./controllers/api');
const { fetchStoredIssues } = require('./controllers/db');
const { fetchJiraIssues } = require('./controllers/jira');
const { PORT } = process.env;
const port = PORT || 8080;

app.use(bodyParser.json());

app.use('/api', api);

fetchStoredIssues().then(fetchJiraIssues).catch(console.error)

app.listen(port, function(){});
