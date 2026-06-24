// src/controllers/taskController.js
//
// Handles all task HTTP requests.
// The most critical function is completeTask() — it calls
// the XP engine in the model and returns the full RPG result
// back to the React frontend so it can show the level-up animation.

const { checkBoardMembership } = require('../models/boardModel');
const { createTask, getTaskById, updateTask, deleteTask, completeTaskWithXP } = require('../models/taskModel');

// ─────────────────────────────────────────────────────
// HELPER: assertMembership
// Repeated permission check extracted to a function.
// Why? To avoid copy-pasting the same 5 lines in every controller.
// If the check logic changes, we fix it here once. (DRY + OCP)
// ─────────────────────────────────────────────────────
const assertMembership = async (boardId, userId, requiredRole = 'editor') => {
  const membership = await checkBoardMembership(boardId, userId);
  if (!membership) return false;
  if (requiredRole === 'owner' && membership.role !== 'owner') return false;
  if (requiredRole === 'editor' && membership.role === 'viewer') return false;
  return true;
};

// POST /api/v1/boards/:boardId/tasks
const newTask = async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const allowed = await assertMembership(boardId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }

    const { column_id, title, description, xp_reward, priority, due_date } = req.body;
    if (!column_id || !title) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'column_id and title are required.', status: 400 }
      });
    }

    const task = await createTask(boardId, column_id, req.user.userId, {
      title, description, xp_reward, priority, due_date
    });
    return res.status(201).json({ task });
  } catch (err) { next(err); }
};

// PATCH /api/v1/boards/:boardId/tasks/:taskId
// Handles both edits AND drag-and-drop moves (column_id change = moving card)
const editTask = async (req, res, next) => {
  try {
    const { boardId, taskId } = req.params;
    const allowed = await assertMembership(boardId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }

    // Guard: reject attempts to use PATCH to mark tasks complete.
    // Completion is a SEPARATE, intentional action — not a field update.
    // This prevents the XP system from being accidentally bypassed.
    if ('is_done' in req.body) {
      return res.status(400).json({
        error: {
          code: 'USE_COMPLETE_ENDPOINT',
          message: 'Use POST /tasks/:taskId/complete to mark a task as done.',
          status: 400,
        }
      });
    }

    const task = await updateTask(taskId, req.body);
    return res.status(200).json({ task });
  } catch (err) { next(err); }
};

// DELETE /api/v1/boards/:boardId/tasks/:taskId
const removeTask = async (req, res, next) => {
  try {
    const { boardId, taskId } = req.params;
    const allowed = await assertMembership(boardId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }
    await deleteTask(taskId);
    return res.status(204).send();
  } catch (err) { next(err); }
};


// ═════════════════════════════════════════════════════
// ★ POST /api/v1/boards/:boardId/tasks/:taskId/complete
//   THE XP ENGINE ENDPOINT
//
// This is the most important endpoint in the entire application.
// The client sends an empty POST body.
// The server does ALL the work and returns a rich result.
//
// Response shape:
// {
//   task:         { ...updated task with is_done: true },
//   xp_awarded:   50,
//   new_total_xp: 950,
//   leveled_up:   true,              ← triggers animation in React
//   new_level: {
//     level_number: 5,
//     title:        "Veteran",
//     class_name:   "Knight"
//   }
// }
// ═════════════════════════════════════════════════════
const completeTask = async (req, res, next) => {
  try {
    const { boardId, taskId } = req.params;

    // Verify the user has access to this board before anything else.
    const allowed = await assertMembership(boardId, req.user.userId);
    if (!allowed) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }

    // This single call runs 5 SQL operations atomically.
    // If any step fails, none of them persist. Safe. Consistent.
    const result = await completeTaskWithXP(taskId, req.user.userId);

    return res.status(200).json(result);
  } catch (err) {
    // The model throws structured errors with statusCode + code set.
    // Our global error handler will format them correctly.
    next(err);
  }
};

module.exports = { newTask, editTask, removeTask, completeTask };
