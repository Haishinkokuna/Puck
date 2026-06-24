// src/models/taskModel.js
//
// All SQL that touches tasks and the xp_ledger.
// The most important function here is completeTaskWithXP() —
// it runs the entire XP award process inside ONE database transaction.
//
// 🍎🍐 Why a transaction?
// Imagine you're buying fruit (completing a task) and paying XP (currency).
// The vendor takes the fruit OFF the shelf (marks task done) AND
// adds the price to your loyalty card (updates XP) in ONE movement.
// If either action fails mid-way — BOTH are reversed.
// You can't have a done task with no XP awarded, or XP awarded with task still open.
// A transaction ensures it's all-or-nothing. Atomically.

const { query, getClient } = require('../config/db');

// ─────────────────────────────────────────────────────
// createTask
// ─────────────────────────────────────────────────────
const createTask = async (boardId, columnId, userId, { title, description, xp_reward, priority, due_date }) => {
  // Auto-position at the bottom of the column
  const posResult = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = $1',
    [columnId]
  );
  const position = posResult.rows[0].next_pos;

  const result = await query(
    `INSERT INTO tasks (column_id, board_id, title, description, xp_reward, priority, due_date, position, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [columnId, boardId, title, description || null, xp_reward || 10, priority || 'normal', due_date || null, position, userId]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// getTaskById
// Used before marking complete — we need the task's xp_reward
// and current status before doing anything else.
// ─────────────────────────────────────────────────────
const getTaskById = async (taskId) => {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// updateTask
// Handles both edits AND drag-and-drop moves (column_id change).
// We use COALESCE so only the fields sent in the request are updated —
// we don't need to send ALL fields every time, just the ones that changed.
// COALESCE(new_value, existing_column) = "use new_value if it's not null,
// otherwise keep the current value in the column."
// ─────────────────────────────────────────────────────
const updateTask = async (taskId, fields) => {
  const { title, description, column_id, priority, due_date, position, xp_reward } = fields;
  const result = await query(
    `UPDATE tasks SET
       title       = COALESCE($1, title),
       description = COALESCE($2, description),
       column_id   = COALESCE($3, column_id),
       priority    = COALESCE($4, priority),
       due_date    = COALESCE($5, due_date),
       position    = COALESCE($6, position),
       xp_reward   = COALESCE($7, xp_reward)
     WHERE id = $8
     RETURNING *`,
    [title||null, description||null, column_id||null, priority||null, due_date||null,
     position!==undefined?position:null, xp_reward||null, taskId]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// deleteTask
// ─────────────────────────────────────────────────────
const deleteTask = async (taskId) => {
  await query('DELETE FROM tasks WHERE id = $1', [taskId]);
};


// ═════════════════════════════════════════════════════
// ★ completeTaskWithXP — THE HEART OF THE RPG SYSTEM ★
//
// This function runs 5 SQL operations inside ONE transaction:
// 1. Re-fetch the task and lock the row (SELECT ... FOR UPDATE)
// 2. Mark the task as done
// 3. Write to the xp_ledger (the bank statement)
// 4. Add XP to the user's total
// 5. Check if the user leveled up → update level if yes
//
// Returns: { task, xp_awarded, new_total_xp }
// ═════════════════════════════════════════════════════
const completeTaskWithXP = async (taskId, userId) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // ── Step 1: Fetch + LOCK the task row ─────────────────
    // "FOR UPDATE" locks this specific row until our transaction ends.
    // Why? If two users try to complete the same task simultaneously,
    // the second one waits. Without this lock, both could "win" the XP.
    // Think of it like: only ONE hand can grab the apple off the shelf.
    const taskResult = await client.query(
      'SELECT * FROM tasks WHERE id = $1 FOR UPDATE',
      [taskId]
    );
    const task = taskResult.rows[0];

    if (!task) {
      await client.query('ROLLBACK');
      const err = new Error('Task not found.');
      err.statusCode = 404; err.code = 'TASK_NOT_FOUND';
      throw err;
    }

    if (task.is_done) {
      await client.query('ROLLBACK');
      const err = new Error('This task has already been completed.');
      err.statusCode = 409; err.code = 'TASK_ALREADY_COMPLETED';
      throw err;
    }

    const xpAwarded = task.xp_reward;

    // ── Step 2: Mark the task as complete ─────────────────
    const doneTask = await client.query(
      `UPDATE tasks
       SET is_done = TRUE, completed_by = $1, completed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, taskId]
    );

    // ── Step 3: Write to the XP ledger (audit trail) ──────
    // This row is IMMUTABLE — we never update or delete ledger entries.
    // It's the receipts. The source of truth for all XP history.
    await client.query(
      `INSERT INTO xp_ledger (user_id, task_id, xp_delta, reason)
       VALUES ($1, $2, $3, 'task_completed')`,
      [userId, taskId, xpAwarded]
    );

    // ── Step 4: Add XP to the user's balance ──────────────
    // We use a RETURNING clause to get the new total_xp in the same query.
    // No need for a separate SELECT — saves one DB round-trip.
    const userResult = await client.query(
      `UPDATE users SET total_xp = total_xp + $1 WHERE id = $2
       RETURNING id, total_xp, current_level_id`,
      [xpAwarded, userId]
    );
    const updatedUser = userResult.rows[0];

    // ── Step 5: (Removed) Auto-leveling is now handled manually via Skill Trees ──

    await client.query('COMMIT');

    // Return everything the frontend needs to show the result
    return {
      task:          doneTask.rows[0],
      xp_awarded:    xpAwarded,
      new_total_xp:  updatedUser.total_xp,
      leveled_up:    false, // Maintained for frontend compatibility, though unused now
      new_level:     null,
    };

  } catch (err) {
    // If ANYTHING above throws, undo EVERYTHING.
    // The DB returns to exactly the state it was in before we started.
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // return connection to pool — ALWAYS
  }
};

module.exports = { createTask, getTaskById, updateTask, deleteTask, completeTaskWithXP };
