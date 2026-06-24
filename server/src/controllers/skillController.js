// src/controllers/skillController.js
const { getSkillTrees, unlockNode } = require('../models/skillModel');
const { query } = require('../config/db');

const fetchTree = async (req, res, next) => {
  try {
    const trees = await getSkillTrees(req.user.userId);
    if (!trees || trees.length === 0) return res.status(404).json({ error: { message: 'Trees not found' } });
    
    // Get user's active title and XP stats
    const userResult = await query(
      `SELECT total_xp, active_title FROM users WHERE id = $1`,
      [req.user.userId]
    );
    const user = userResult.rows[0];

    const spentResult = await query(
      `SELECT COALESCE(SUM(n.xp_cost), 0) AS total_spent
       FROM user_unlocked_nodes uun
       JOIN skill_nodes n ON n.id = uun.node_id
       WHERE uun.user_id = $1`,
       [req.user.userId]
    );
    const totalSpent = parseInt(spentResult.rows[0].total_spent, 10);
    const availableXp = user.total_xp - totalSpent;

    res.json({
      trees,
      user_stats: {
        total_xp: user.total_xp,
        available_xp: availableXp,
        active_title: user.active_title
      }
    });
  } catch (error) { next(error); }
};

const purchaseNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const result = await unlockNode(req.user.userId, nodeId);
    
    // Auto-equip the title if they want
    if (req.body.equip) {
      await query(`UPDATE users SET active_title = $1 WHERE id = $2`, [result.newTitle, req.user.userId]);
    }
    
    res.json({ message: 'Node unlocked!', newTitle: result.newTitle });
  } catch (error) {
    if (error.message === 'Already unlocked' || error.message === 'Not enough XP' || error.message === 'Prerequisites not met') {
      return res.status(400).json({ error: { message: error.message } });
    }
    next(error);
  }
};

const equipTitle = async (req, res, next) => {
  try {
    const { title } = req.body;
    // Verify they actually own the node granting this title
    const checkResult = await query(
      `SELECT 1 FROM user_unlocked_nodes uun
       JOIN skill_nodes n ON n.id = uun.node_id
       WHERE uun.user_id = $1 AND n.name = $2`,
       [req.user.userId, title]
    );
    if (checkResult.rows.length === 0 && title !== 'Apprentice') {
      return res.status(403).json({ error: { message: 'You have not unlocked this title yet.' } });
    }

    await query(`UPDATE users SET active_title = $1 WHERE id = $2`, [title, req.user.userId]);
    res.json({ message: 'Title equipped', title });
  } catch (error) { next(error); }
};

const createTree = async (req, res, next) => {
  try {
    const { name, task_type_id, icon_name } = req.body;
    if (!name || !task_type_id) {
      return res.status(400).json({ error: { message: 'Name and task_type_id are required' } });
    }
    const result = await query(
      `INSERT INTO skill_trees (name, description, task_type_id, icon_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, `Skill tree for ${name}`, task_type_id, icon_name || 'star']
    );
    res.status(201).json({ tree: result.rows[0] });
  } catch (error) { next(error); }
};

const createNode = async (req, res, next) => {
  try {
    const { tree_id, name, description, xp_cost, x_pos, y_pos, color_hex, icon_name, parent_node_id } = req.body;
    
    // Insert node
    const nodeResult = await query(
      `INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex, icon_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tree_id, name, description || '', xp_cost || 0, x_pos || 50, y_pos || 50, color_hex || '#fff', icon_name || 'star']
    );
    const newNode = nodeResult.rows[0];

    // Insert edge if parent is provided
    if (parent_node_id) {
      await query(
        `INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES ($1, $2)`,
        [parent_node_id, newNode.id]
      );
    }
    res.status(201).json({ node: newNode });
  } catch (error) { next(error); }
};

const updateNodePosition = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { x_pos, y_pos } = req.body;
    
    if (x_pos == null || y_pos == null) {
      return res.status(400).json({ error: { message: 'x_pos and y_pos are required' } });
    }

    const result = await query(
      `UPDATE skill_nodes SET x_pos = $1, y_pos = $2 WHERE id = $3 RETURNING *`,
      [x_pos, y_pos, nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Node not found' } });
    }

    res.json({ node: result.rows[0] });
  } catch (error) { next(error); }
};

module.exports = {
  fetchTree,
  purchaseNode,
  equipTitle,
  createTree,
  createNode,
  updateNodePosition
};
