const pool = require('./config/database');
async function run() {
  const [rows] = await pool.query("SELECT @@GLOBAL.transaction_isolation, @@SESSION.transaction_isolation;");
  console.log(rows);
  process.exit(0);
}
run();
