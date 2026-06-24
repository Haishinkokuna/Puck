// src/controllers/boardController.js
//
// Handles HTTP requests for boards and columns.
// Every function here follows the same pattern:
//   1. Validate input
//   2. Check permissions
//   3. Call the model
//   4. Return the response
// No SQL. No token parsing. Just orchestration. (SRP)

const {
  getBoardsByUser, getBoardById, createBoard, updateBoard, deleteBoard,
  createColumn, updateColumn, deleteColumn, checkBoardMembership,
  createTaskType, updateTaskType, deleteTaskType
} = require('../models/boardModel');
const { getClient } = require('../config/db');

// GET /api/v1/boards
const getBoards = async (req, res, next) => {
  try {
    const boards = await getBoardsByUser(req.user.userId);
    return res.status(200).json({ boards });
  } catch (err) { next(err); }
};

// GET /api/v1/boards/:boardId
const getBoard = async (req, res, next) => {
  try {
    const board = await getBoardById(req.params.boardId, req.user.userId);
    if (!board) {
      return res.status(404).json({
        error: { code: 'BOARD_NOT_FOUND', message: 'Board not found or access denied.', status: 404 }
      });
    }
    return res.status(200).json({ board });
  } catch (err) { next(err); }
};

// POST /api/v1/boards
const newBoard = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || name.trim().length < 1) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Board name is required.', status: 400 }
      });
    }
    const board = await createBoard(req.user.userId, { name: name.trim(), description });
    return res.status(201).json({ board });
  } catch (err) { next(err); }
};

// PATCH /api/v1/boards/:boardId
const editBoard = async (req, res, next) => {
  try {
    const membership = await checkBoardMembership(req.params.boardId, req.user.userId);
    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to edit this board.', status: 403 }
      });
    }
    const board = await updateBoard(req.params.boardId, req.body);
    return res.status(200).json({ board });
  } catch (err) { next(err); }
};

// DELETE /api/v1/boards/:boardId
const removeBoard = async (req, res, next) => {
  try {
    const membership = await checkBoardMembership(req.params.boardId, req.user.userId);
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the board owner can delete a board.', status: 403 }
      });
    }
    await deleteBoard(req.params.boardId);
    return res.status(204).send(); // 204 = success, no body
  } catch (err) { next(err); }
};

// POST /api/v1/boards/:boardId/columns
const newColumn = async (req, res, next) => {
  try {
    const membership = await checkBoardMembership(req.params.boardId, req.user.userId);
    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }
    const column = await createColumn(req.params.boardId, req.body);
    return res.status(201).json({ column });
  } catch (err) { next(err); }
};

// PATCH /api/v1/boards/:boardId/columns/:columnId
const editColumn = async (req, res, next) => {
  try {
    const membership = await checkBoardMembership(req.params.boardId, req.user.userId);
    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', status: 403 } });
    }
    const column = await updateColumn(req.params.columnId, req.body);
    return res.status(200).json({ column });
  } catch (err) { next(err); }
};

// DELETE /api/v1/boards/:boardId/columns/:columnId
const removeColumn = async (req, res, next) => {
  try {
    const membership = await checkBoardMembership(req.params.boardId, req.user.userId);
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only owners can delete columns.', status: 403 } });
    }
    await deleteColumn(req.params.columnId);
    return res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = {
  getBoards, getBoard, newBoard, editBoard, removeBoard,
  newColumn, editColumn, removeColumn
};
