require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Connected to DB');

    const sqlPath = path.join(__dirname, '003_global_task_types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await query(sql);

    console.log('Migration v5 (Global Task Types) completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
