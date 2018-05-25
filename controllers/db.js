const pgp = require('pg-promise')({});

const db = pgp({
  database : process.env.RDS_DB_NAME,
  host     : process.env.RDS_HOSTNAME,
  password : process.env.RDS_PASSWORD,
  port     : process.env.RDS_PORT,
  user     : process.env.RDS_USERNAME,
});

module.exports = {
  dropIssue: issue => db.none(`UPDATE tickets SET status = 'NO TRACK' WHERE id = $1`, [issue.id]),
  fetchStoredIssue: issue => db.one(`SELECT * FROM tickets WHERE id = $1 RETURNING *`, [issue.id]),
  fetchStoredIssues: () => db.any(`SELECT * FROM tickets WHERE status <> 'NO TRACK' ORDER BY updated DESC`),
  transactions: db.tx,
};
