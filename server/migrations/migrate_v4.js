require('dotenv').config({ path: '../.env' });
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Connected to DB');

    // 1. Add task_type_name to skill_nodes to categorize nodes
    await query(`
      ALTER TABLE skill_nodes 
      ADD COLUMN IF NOT EXISTS task_type_name VARCHAR(100);
    `);

    // 2. Set default task types for the hardcoded Fullstack Constellation nodes
    await query(`UPDATE skill_nodes SET task_type_name = 'Frontend' WHERE name IN ('DOM Weaver', 'React Sorcerer')`);
    await query(`UPDATE skill_nodes SET task_type_name = 'Backend' WHERE name IN ('Query Slayer', 'Node Architect')`);
    await query(`UPDATE skill_nodes SET task_type_name = 'Fullstack' WHERE name IN ('Puck Grandmaster', 'Apprentice')`);

    console.log('Migration v4 completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
