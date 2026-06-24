require('dotenv').config({ path: '../.env' });
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Connected to DB');

    // 1. Add task_type_id and icon_name to skill_trees
    await query(`
      ALTER TABLE skill_trees 
      ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES task_types(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'star';
    `);

    // 2. Add icon_name to skill_nodes so nodes can have icons
    await query(`
      ALTER TABLE skill_nodes
      ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'star';
    `);

    // 3. Set the default Fullstack Tree icon
    await query(`
      UPDATE skill_trees SET icon_name = 'globe' WHERE name = 'Fullstack Constellation';
    `);

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
