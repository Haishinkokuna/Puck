# ============================================================
# API Routes Contract — BetterKanban RPG
# Version: 1.0
#
# This document is the "menu" our market vendor (Express API)
# offers to customers (React frontend).
# All routes are prefixed with: /api/v1
# Auth: JWT Bearer token required on all routes marked [AUTH]
# ============================================================

## ─────────────────────────────────────────────
## AUTH ROUTES  /api/v1/auth
## ─────────────────────────────────────────────

POST   /api/v1/auth/register
  Body:    { username, email, password }
  Returns: { user: { id, username, email, level, title }, token }
  Why:     Creates the user record + assigns Level 1 defaults.

POST   /api/v1/auth/login
  Body:    { email, password }
  Returns: { user: { id, username, total_xp, level, title, class }, token }
  Why:     Validates credentials, returns JWT for subsequent requests.

POST   /api/v1/auth/logout
  [AUTH]
  Why:     Stateless JWT — client discards token. Endpoint exists
           for future token blacklist / refresh token invalidation.


## ─────────────────────────────────────────────
## USER / PROFILE ROUTES  /api/v1/users
## ─────────────────────────────────────────────

GET    /api/v1/users/me
  [AUTH]
  Returns: { id, username, email, total_xp, level, title, class_name,
             next_level_xp, xp_to_next, avatar_url, preferred_lang }
  Why:     The full profile snapshot — used by the RPG HUD component.

PATCH  /api/v1/users/me
  [AUTH]
  Body:    { username?, avatar_url?, preferred_lang? }
  Returns: { updated user object }
  Why:     Users can change display name and language preference.

GET    /api/v1/users/me/xp-ledger
  [AUTH]
  Query:   ?page=1&limit=20
  Returns: { entries: [{ xp_delta, reason, task_title, created_at }], total }
  Why:     The bank statement view — shows XP history in the UI.

GET    /api/v1/users/leaderboard
  [AUTH]
  Query:   ?limit=10
  Returns: [{ rank, username, total_xp, level, title, class_name }]
  Why:     Social gamification — motivates users to complete more tasks.


## ─────────────────────────────────────────────
## BOARD ROUTES  /api/v1/boards
## ─────────────────────────────────────────────

GET    /api/v1/boards
  [AUTH]
  Returns: [{ id, name, description, role, member_count, created_at }]
  Why:     Lists all boards the authenticated user belongs to.

POST   /api/v1/boards
  [AUTH]
  Body:    { name, description? }
  Returns: { board } + auto-creates 3 default columns:
           "Backlog" (pos 0), "In Progress" (pos 1), "Done" (pos 2)
  Why:     Every board needs a starting skeleton so users aren't
           dropped into an empty canvas with no guidance.

GET    /api/v1/boards/:boardId
  [AUTH]
  Returns: { board, columns: [{ id, name, position, tasks: [...] }] }
  Why:     Single payload for the full board view — avoids N+1 queries.
           Columns and tasks are nested (JOIN + aggregate in SQL).

PATCH  /api/v1/boards/:boardId
  [AUTH] [OWNER/EDITOR only]
  Body:    { name?, description? }
  Returns: { updated board }

DELETE /api/v1/boards/:boardId
  [AUTH] [OWNER only]
  Why:     Cascade delete via DB — removes columns, tasks, ledger entries.

POST   /api/v1/boards/:boardId/members
  [AUTH] [OWNER only]
  Body:    { email, role }
  Returns: { membership }
  Why:     Invites another user by email to collaborate.


## ─────────────────────────────────────────────
## COLUMN ROUTES  /api/v1/boards/:boardId/columns
## ─────────────────────────────────────────────

POST   /api/v1/boards/:boardId/columns
  [AUTH] [OWNER/EDITOR]
  Body:    { name, position? }
  Returns: { column }

PATCH  /api/v1/boards/:boardId/columns/:columnId
  [AUTH] [OWNER/EDITOR]
  Body:    { name?, position? }
  Returns: { updated column }
  Why:     Handles both rename AND drag-and-drop reorder in one endpoint.

DELETE /api/v1/boards/:boardId/columns/:columnId
  [AUTH] [OWNER only]
  Why:     Cascade deletes tasks within — destructive, owner-only.


## ─────────────────────────────────────────────
## TASK ROUTES  /api/v1/boards/:boardId/tasks
## ─────────────────────────────────────────────

POST   /api/v1/boards/:boardId/tasks
  [AUTH] [OWNER/EDITOR]
  Body:    { column_id, title, description?, xp_reward?, priority?, due_date? }
  Returns: { task }
  Why:     xp_reward is set at creation time. Default is 10 if omitted.

PATCH  /api/v1/boards/:boardId/tasks/:taskId
  [AUTH] [OWNER/EDITOR]
  Body:    { title?, description?, column_id?, priority?, due_date?,
             position?, xp_reward? }
  Returns: { task }
  Why:     This is the drag-and-drop move endpoint AND the edit endpoint.
           Changing column_id = moving the card between columns.

  ⚠️  CRITICAL RULE: This endpoint does NOT mark tasks as complete.
      Completion is a separate, privileged action (see below).
      Why? So that moving a task to the "Done" column does not
      auto-award XP unless explicitly triggered. The game logic
      is intentional, not accidental.

POST   /api/v1/boards/:boardId/tasks/:taskId/complete
  [AUTH] [OWNER/EDITOR]
  Body:    {} (empty — the server decides everything)
  Returns: {
    task,
    xp_awarded,
    new_total_xp,
    leveled_up: boolean,
    new_level?: { level_number, title, class_name }
  }
  Why:     THE most important endpoint. This is the XP engine.
           The backend:
             1. Validates the task isn't already done.
             2. Reads xp_reward from the task row.
             3. Writes to xp_ledger (audit trail).
             4. Increments users.total_xp atomically (SQL transaction).
             5. Checks if new total_xp crosses a level threshold.
             6. If yes, updates users.current_level_id + returns level data.
           All in ONE database transaction — no partial states.

DELETE /api/v1/boards/:boardId/tasks/:taskId
  [AUTH] [OWNER/EDITOR]
  Why:     Soft consideration: completed tasks could be archived instead.
           For v1, hard delete. Future: add deleted_at for soft delete.


## ─────────────────────────────────────────────
## LEVELS ROUTE  /api/v1/levels
## ─────────────────────────────────────────────

GET    /api/v1/levels
  [AUTH]
  Returns: [{ level_number, xp_required, title, class_name, description }]
  Why:     Frontend uses this to render the "Level Progression" map
           and calculate "XP to next level" without hardcoding values.


## ─────────────────────────────────────────────
## ERROR RESPONSE FORMAT (all endpoints)
## ─────────────────────────────────────────────
{
  "error": {
    "code": "TASK_ALREADY_COMPLETED",   // machine-readable code
    "message": "This task has already been completed.", // human-readable (i18n key on client)
    "status": 409
  }
}

## ─────────────────────────────────────────────
## HTTP STATUS CODE CONVENTIONS
## ─────────────────────────────────────────────
200  OK              — Successful GET / PATCH
201  Created         — Successful POST that creates a resource
204  No Content      — Successful DELETE
400  Bad Request     — Validation error (missing field, bad type)
401  Unauthorized    — No token / invalid token
403  Forbidden       — Valid token but insufficient role
404  Not Found       — Resource doesn't exist or user has no access
409  Conflict        — Duplicate resource or state conflict (task already done)
500  Server Error    — Unexpected — always log, never expose internals
