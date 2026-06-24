// src/models/boardModel.js
//
// All SQL that touches the boards and columns tables.
// Why separate from taskModel? Because boards and tasks are different
// aggregate roots — a board can exist without tasks, and tasks
// belong to a board via columns. Keeping them split lets us
// scale, test, and swap each independently. (SRP)

const { query } = require('../config/db');

// ─────────────────────────────────────────────────────
// getBoardsByUser
// Returns all boards a user belongs to (as owner OR member).
// We use a LEFT JOIN on board_members so if a user created the board
// they also appear here even if not explicitly added as a member.
// ─────────────────────────────────────────────────────
const getBoardsByUser = async (userId) => {
  const result = await query(
    `SELECT DISTINCT
       b.id, b.name, b.description, b.created_at,
       bm.role,
       COUNT(DISTINCT t.id) AS task_count
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
     LEFT JOIN columns c   ON c.board_id = b.id
     LEFT JOIN tasks t     ON t.column_id = c.id
     GROUP BY b.id, b.name, b.description, b.created_at, bm.role
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// ─────────────────────────────────────────────────────
// getBoardById
// Fetches a single board WITH all its columns and tasks nested.
// This is a single SQL query that we reassemble in JavaScript.
// Why not 3 separate queries (board, columns, tasks)?
// Because 3 round-trips to the DB = 3x the latency.
// One query → less time waiting for the network.
// ─────────────────────────────────────────────────────
const getBoardById = async (boardId, userId) => {
  // First verify the user has access to this board
  const accessCheck = await query(
    `SELECT b.id, b.name, b.description, b.owner_id, bm.role
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $2
     WHERE b.id = $1`,
    [boardId, userId]
  );
  if (!accessCheck.rows[0]) return null;

  // Fetch all task types for this board
  const taskTypesResult = await query(
    `SELECT id, name, icon_name, color_hex FROM task_types WHERE board_id = $1`,
    [boardId]
  );
  const taskTypes = taskTypesResult.rows;

  // Fetch all columns with their tasks in one query, joined with task_types
  const result = await query(
    `SELECT
       c.id AS column_id, c.name AS column_name, c.position AS column_position,
       t.id AS task_id, t.title AS task_title, t.description AS task_description,
       t.xp_reward, t.priority, t.due_date, t.position AS task_position,
       t.is_done, t.completed_by, t.completed_at, t.created_by, t.created_at AS task_created_at,
       t.task_type_id, tt.name AS task_type_name, tt.icon_name AS task_type_icon, tt.color_hex AS task_type_color
     FROM columns c
     LEFT JOIN tasks t ON t.column_id = c.id
     LEFT JOIN task_types tt ON t.task_type_id = tt.id
     WHERE c.board_id = $1
     ORDER BY c.position ASC, t.position ASC`,
    [boardId]
  );

  // Reassemble flat rows into nested { board, columns: [{ tasks: [] }] }
  // Think of it like: SQL gave us a flat spreadsheet, we fold it into a tree.
  const board = accessCheck.rows[0];
  const columnsMap = new Map();

  for (const row of result.rows) {
    if (!columnsMap.has(row.column_id)) {
      columnsMap.set(row.column_id, {
        id:       row.column_id,
        name:     row.column_name,
        position: row.column_position,
        tasks:    [],
      });
    }
    // Only push a task row if a task actually exists (LEFT JOIN can produce NULLs)
    if (row.task_id) {
      columnsMap.get(row.column_id).tasks.push({
        id:           row.task_id,
        title:        row.task_title,
        description:  row.task_description,
        xp_reward:    row.xp_reward,
        priority:     row.priority,
        due_date:     row.due_date,
        position:     row.task_position,
        is_done:      row.is_done,
        completed_by: row.completed_by,
        completed_at: row.completed_at,
        created_by:   row.created_by,
        created_at:   row.task_created_at,
        task_type: row.task_type_id ? {
          id: row.task_type_id,
          name: row.task_type_name,
          icon_name: row.task_type_icon,
          color_hex: row.task_type_color
        } : null,
      });
    }
  }

  return {
    ...board,
    task_types: taskTypes,
    columns: Array.from(columnsMap.values()),
  };
};

// ─────────────────────────────────────────────────────
// createBoard
// Creates the board AND inserts the creator as owner in board_members.
// Also auto-creates 3 default columns so the user isn't dropped
// into an empty canvas.
// We use a TRANSACTION here — if the columns insert fails,
// we don't want a board with no columns to exist in the DB.
// ─────────────────────────────────────────────────────
const createBoard = async (userId, { name, description }) => {
  const { getClient } = require('../config/db');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Create the board
    const boardResult = await client.query(
      `INSERT INTO boards (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, owner_id, created_at`,
      [userId, name, description || null]
    );
    const board = boardResult.rows[0];

    // 2. Add creator as owner in board_members
    await client.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [board.id, userId]
    );

    // 3. Auto-create 3 default columns
    const defaultColumns = ['Backlog', 'In Progress', 'Done'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await client.query(
        `INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3)`,
        [board.id, defaultColumns[i], i]
      );
    }

    await client.query('COMMIT');
    return board;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // ALWAYS release the client back to the pool.
    // Without this line, we'd exhaust the pool after 10 requests.
    client.release();
  }
};

// ─────────────────────────────────────────────────────
// updateBoard / deleteBoard / createColumn / updateColumn / deleteColumn
// ─────────────────────────────────────────────────────
const updateBoard = async (boardId, { name, description }) => {
  const result = await query(
    `UPDATE boards SET name = COALESCE($1, name), description = COALESCE($2, description)
     WHERE id = $3 RETURNING *`,
    [name || null, description || null, boardId]
  );
  return result.rows[0];
};

const deleteBoard = async (boardId) => {
  // CASCADE in the schema handles deleting columns, tasks, ledger entries
  await query('DELETE FROM boards WHERE id = $1', [boardId]);
};

const createColumn = async (boardId, { name, position }) => {
  // If no position given, put it at the end
  const posResult = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM columns WHERE board_id = $1',
    [boardId]
  );
  const pos = position !== undefined ? position : posResult.rows[0].next_pos;
  const result = await query(
    `INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3) RETURNING *`,
    [boardId, name, pos]
  );
  return result.rows[0];
};

const updateColumn = async (columnId, { name, position }) => {
  const result = await query(
    `UPDATE columns SET name = COALESCE($1, name), position = COALESCE($2, position)
     WHERE id = $3 RETURNING *`,
    [name || null, position !== undefined ? position : null, columnId]
  );
  return result.rows[0];
};

const deleteColumn = async (columnId) => {
  await query('DELETE FROM columns WHERE id = $1', [columnId]);
};

const checkBoardMembership = async (boardId, userId) => {
  const result = await query(
    'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  return result.rows[0]; // { role: 'owner' | 'editor' | 'viewer' } or undefined
};

const createTaskType = async (boardId, { name, icon_name, color_hex }) => {
  const result = await query(
    `INSERT INTO task_types (board_id, name, icon_name, color_hex) VALUES ($1, $2, $3, $4) RETURNING *`,
    [boardId, name, icon_name || 'circle', color_hex || '#4A9EDB']
  );
  return result.rows[0];
};

const updateTaskType = async (typeId, { name, icon_name, color_hex }) => {
  const result = await query(
    `UPDATE task_types SET name = COALESCE($1, name), icon_name = COALESCE($2, icon_name), color_hex = COALESCE($3, color_hex)
     WHERE id = $4 RETURNING *`,
    [name || null, icon_name || null, color_hex || null, typeId]
  );
  return result.rows[0];
};

const deleteTaskType = async (typeId) => {
  await query('DELETE FROM task_types WHERE id = $1', [typeId]);
};

module.exports = {
  getBoardsByUser, getBoardById, createBoard, updateBoard, deleteBoard,
  createColumn, updateColumn, deleteColumn, checkBoardMembership,
  createTaskType, updateTaskType, deleteTaskType,
};
