-- 003_global_task_types.sql
-- Make Task Types global per user instead of locked to a single board.

-- 1. Add user_id to task_types
ALTER TABLE task_types ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 2. Populate user_id based on the board's owner
UPDATE task_types
SET user_id = boards.owner_id
FROM boards
WHERE task_types.board_id = boards.id;

-- 3. Make user_id NOT NULL and board_id nullable (so old queries don't instantly break, but new ones use user_id)
ALTER TABLE task_types ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE task_types ALTER COLUMN board_id DROP NOT NULL;
