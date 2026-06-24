const { query } = require('../config/db');

const getTaskTypes = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM task_types WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const createTaskType = async (req, res, next) => {
  try {
    const { name, icon_name, color_hex } = req.body;
    const result = await query(
      `INSERT INTO task_types (user_id, name, icon_name, color_hex)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.userId, name, icon_name || 'Code', color_hex || '#4A9EDB']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

const deleteTaskType = async (req, res, next) => {
  try {
    const { typeId } = req.params;
    await query(
      `DELETE FROM task_types WHERE id = $1 AND user_id = $2`,
      [typeId, req.user.userId]
    );
    res.json({ message: 'Task type deleted' });
  } catch (err) { next(err); }
};

module.exports = { getTaskTypes, createTaskType, deleteTaskType };
