require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const api = require('./controllers/api');
const { modelJiraIssues, fetchStoredIssues } = require('./models/issues');
const socketServer = require('./controllers/socket-server');
const { PORT } = process.env;
const port = PORT || 8080;

app.use(bodyParser.json());
app.use('/api', api);
app.listen(port, () => {/* ¯\_(ツ)_/¯ */});


socketServer.start(() => {
  fetchStoredIssues().then(modelJiraIssues).catch(console.error);
});

