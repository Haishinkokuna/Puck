require('dotenv').config({ path: '../.env' });
const { query } = require('../src/config/db');

async function run() {
  try {
    await query(`UPDATE skill_nodes SET icon_name = 'book' WHERE name = 'Apprentice'`);
    await query(`UPDATE skill_nodes SET icon_name = 'code' WHERE name = 'DOM Weaver'`);
    await query(`UPDATE skill_nodes SET icon_name = 'wand' WHERE name = 'React Sorcerer'`);
    await query(`UPDATE skill_nodes SET icon_name = 'sword' WHERE name = 'Query Slayer'`);
    await query(`UPDATE skill_nodes SET icon_name = 'database' WHERE name = 'Node Architect'`);
    await query(`UPDATE skill_nodes SET icon_name = 'crown' WHERE name = 'Puck Grandmaster'`);
    console.log('Icons updated');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
