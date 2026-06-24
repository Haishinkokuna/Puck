// src/models/skillModel.js
const { query } = require('../config/db');

// Get all skill trees available to the user
const getSkillTrees = async (userId) => {
  // Get the default tree AND any trees tied to task types on boards the user is a member of
  const treesResult = await query(`
    SELECT DISTINCT st.* 
    FROM skill_trees st
    LEFT JOIN task_types tt ON st.task_type_id = tt.id
    LEFT JOIN board_members bm ON tt.board_id = bm.board_id AND bm.user_id = $1
    WHERE st.is_default = true OR bm.user_id = $1
    ORDER BY st.is_default DESC, st.created_at ASC
  `, [userId]);
  
  const trees = treesResult.rows;
  if (trees.length === 0) return [];

  const treeIds = trees.map(t => t.id);

  // Get nodes for all these trees
  const nodesResult = await query(
    `SELECT n.*, 
       CASE WHEN uun.node_id IS NOT NULL THEN true ELSE false END AS is_unlocked
     FROM skill_nodes n
     LEFT JOIN user_unlocked_nodes uun ON uun.node_id = n.id AND uun.user_id = $1
     WHERE n.tree_id = ANY($2)`,
    [userId, treeIds]
  );

  // Get edges for all these trees
  const edgesResult = await query(
    `SELECT e.* 
     FROM skill_edges e
     JOIN skill_nodes n ON e.parent_node_id = n.id
     WHERE n.tree_id = ANY($1)`,
    [treeIds]
  );

  // Assemble the trees
  return trees.map(tree => ({
    ...tree,
    nodes: nodesResult.rows.filter(n => n.tree_id === tree.id),
    edges: edgesResult.rows.filter(e => {
      // e.parent_node_id must belong to this tree
      const parentNode = nodesResult.rows.find(n => n.id === e.parent_node_id);
      return parentNode && parentNode.tree_id === tree.id;
    })
  }));
};

// Attempt to unlock a node
const unlockNode = async (userId, nodeId) => {
  const { getClient } = require('../config/db');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Check if user already unlocked it
    const checkResult = await client.query(
      'SELECT 1 FROM user_unlocked_nodes WHERE user_id = $1 AND node_id = $2',
      [userId, nodeId]
    );
    if (checkResult.rows.length > 0) throw new Error('Already unlocked');

    // 2. Get node info (cost, prerequisites)
    const nodeResult = await client.query('SELECT * FROM skill_nodes WHERE id = $1', [nodeId]);
    const node = nodeResult.rows[0];
    if (!node) throw new Error('Node not found');

    // 3. Check prerequisites
    const prereqsResult = await client.query(
      `SELECT parent_node_id FROM skill_edges WHERE child_node_id = $1`,
      [nodeId]
    );
    const prereqs = prereqsResult.rows.map(r => r.parent_node_id);
    if (prereqs.length > 0) {
      const unlockedPrereqsResult = await client.query(
        `SELECT node_id FROM user_unlocked_nodes WHERE user_id = $1 AND node_id = ANY($2)`,
        [userId, prereqs]
      );
      const unlockedPrereqs = unlockedPrereqsResult.rows.map(r => r.node_id);
      
      // Node logic: usually you need ALL prerequisites
      const hasAllPrereqs = prereqs.every(id => unlockedPrereqs.includes(id));
      if (!hasAllPrereqs) throw new Error('Prerequisites not met');
    }

    // 4. Check user XP
    const userResult = await client.query('SELECT total_xp FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = userResult.rows[0];
    
    // We also need to sum up spent XP
    const spentResult = await client.query(
      `SELECT COALESCE(SUM(n.xp_cost), 0) AS total_spent
       FROM user_unlocked_nodes uun
       JOIN skill_nodes n ON n.id = uun.node_id
       WHERE uun.user_id = $1`,
       [userId]
    );
    const totalSpent = parseInt(spentResult.rows[0].total_spent, 10);
    const availableXp = user.total_xp - totalSpent;

    if (availableXp < node.xp_cost) throw new Error('Not enough XP');

    // 5. Unlock node
    await client.query(
      'INSERT INTO user_unlocked_nodes (user_id, node_id) VALUES ($1, $2)',
      [userId, nodeId]
    );

    await client.query('COMMIT');
    return { success: true, newTitle: node.name };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { getSkillTrees, unlockNode };
