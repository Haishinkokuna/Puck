// src/routes/boardRoutes.js
//
// All board and column routes.
// Every route is [AUTH] — authenticate middleware runs first,
// attaching req.user before any controller sees the request.

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getBoards, getBoard, newBoard, editBoard, removeBoard,
  newColumn, editColumn, removeColumn
} = require('../controllers/boardController');
const { newTask, editTask, removeTask, completeTask } = require('../controllers/taskController');

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

// ── Board routes ─────────────────────────────────────
router.get('/',              getBoards);         // GET  /api/v1/boards
router.post('/',             newBoard);          // POST /api/v1/boards
router.get('/:boardId',      getBoard);          // GET  /api/v1/boards/:boardId
router.patch('/:boardId',    editBoard);         // PATCH /api/v1/boards/:boardId
router.delete('/:boardId',   removeBoard);       // DELETE /api/v1/boards/:boardId

// ── Column routes ────────────────────────────────────
router.post('/:boardId/columns',                   newColumn);    // POST
router.patch('/:boardId/columns/:columnId',        editColumn);   // PATCH
router.delete('/:boardId/columns/:columnId',       removeColumn); // DELETE

// ── Task routes ───────────────────────────────────────
router.post('/:boardId/tasks',                     newTask);      // POST
router.patch('/:boardId/tasks/:taskId',            editTask);     // PATCH (edit OR drag-drop)
router.delete('/:boardId/tasks/:taskId',           removeTask);   // DELETE

// ── THE XP ENGINE ROUTE ───────────────────────────────
// Separate POST endpoint — not a PATCH — because completion
// is a distinct, irreversible action that triggers a transaction.
router.post('/:boardId/tasks/:taskId/complete',    completeTask); // POST /complete

module.exports = router;
