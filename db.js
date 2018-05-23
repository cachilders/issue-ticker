const pgp = require('pg-promise')({});

const db = pgp({
  database : process.env.RDS_DB_NAME,
  host     : process.env.RDS_HOSTNAME,
  password : process.env.RDS_PASSWORD,
  port     : process.env.RDS_PORT,
  user     : process.env.RDS_USERNAME,
});

module.exports = db;
