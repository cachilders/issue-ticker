const { fetchStoredIssues } = require('../models/issues');
const express = require('express');
const router = express.Router();

router.get('/fetch_issues', (req, res) => {
  fetchStoredIssues()
    .then(data => res.send(data))
    .catch(error => res.send(error));
});

module.exports = router;
