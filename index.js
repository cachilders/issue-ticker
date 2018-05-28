require('dotenv').config();
const app = require('express')();
const bodyParser = require('body-parser');
const api = require('./controllers/api');
const socketServer = require('./controllers/socket-server');
const { modelJiraIssues, fetchStoredIssues } = require('./models/issues');
const port = process.env.PORT || require('./config/constants').PORT;

app.use(bodyParser.json());
app.use('/api', api);

app.listen(port, () => {
  socketServer.start(() => {
    fetchStoredIssues()
      .then(modelJiraIssues)
      .catch(console.error);
  });
});
