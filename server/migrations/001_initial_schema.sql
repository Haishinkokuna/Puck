-- ============================================================
-- Migration: 001_initial_schema.sql
-- Why: This is the single source of truth for our data shape.
-- Keeping it in a versioned migration file means any developer
-- (or Docker container) can rebuild the exact same DB from scratch.
-- This follows the Single Responsibility Principle — the DB only
-- stores and relates data; it never runs game logic.
-- ============================================================

-- ─────────────────────────────────────────────
-- EXTENSION: Use UUIDs as primary keys.
-- Why UUIDs over auto-increment integers?
-- Because when we scale to multiple servers or shard the DB later,
-- two different servers will never generate the same UUID.
-- Think of it like: integers are house numbers on one street,
-- UUIDs are GPS coordinates — globally unique.
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────
-- TABLE: levels
-- The "reward catalogue" at the market stall.
-- Defines WHAT a user unlocks at each XP threshold.
-- We seed this table once; the API reads from it on every level-up check.
-- Stored separately so a game designer can update titles/classes
-- WITHOUT touching application code. (Open/Closed Principle)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS levels (
    id            SERIAL PRIMARY KEY,
    level_number  INTEGER NOT NULL UNIQUE,   -- e.g., 1, 2, 3...
    xp_required   INTEGER NOT NULL,          -- total XP needed to reach this level
    title         VARCHAR(100) NOT NULL,     -- e.g., "Apprentice Scribe"
    class_name    VARCHAR(100) NOT NULL,     -- e.g., "Peasant", "Knight", "Archmage"
    description   TEXT,                      -- flavour text shown in the UI
    created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- TABLE: users
-- The loyalty card. Tracks who the user is and their XP wallet.
-- password_hash: we NEVER store plain text passwords.
-- Think of it like the market keeps a hashed fingerprint, not your name.
-- current_level_id: a foreign key pointing to the levels table —
-- this is our "which reward tier are you on?" reference.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username          VARCHAR(50) NOT NULL UNIQUE,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    total_xp          INTEGER NOT NULL DEFAULT 0,
    current_level_id  INTEGER NOT NULL DEFAULT 1 REFERENCES levels(id),
    avatar_url        TEXT,
    preferred_lang    VARCHAR(10) NOT NULL DEFAULT 'en', -- i18n preference: 'en' or 'es'
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- TABLE: boards
-- A fruit basket. Groups tasks under a named project.
-- owner_id: the user who created the board (the basket owner).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- TABLE: board_members
-- Who has access to which basket (board)?
-- Role: 'owner', 'editor', 'viewer' — keeps permissions clean.
-- (Interface Segregation: each role only does what it's allowed to)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_members (
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'editor',
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id)  -- composite key: one membership per user per board
);


-- ─────────────────────────────────────────────
-- TABLE: columns
-- Sections of the basket: "To Do", "In Progress", "Done".
-- position: an integer for drag-and-drop ordering (0, 1, 2...).
-- Why store position in the DB? So column order is persistent across
-- sessions and devices. The frontend reads it, not calculates it.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS columns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- TABLE: tasks
-- The individual pieces of fruit. Each task has an XP bounty.
-- xp_reward: how many XP completing THIS task awards.
--   This can vary by task difficulty — a "Kill the Dragon" task
--   worth 100 XP vs. a "Send an email" worth 5 XP.
-- completed_by: who claimed the XP (NULL until the task is done).
-- completed_at: timestamp of completion — used for analytics later.
-- position: ordering within a column (for drag-and-drop).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id     UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    xp_reward     INTEGER NOT NULL DEFAULT 10,    -- XP bounty for this task
    priority      VARCHAR(20) DEFAULT 'normal',   -- 'low', 'normal', 'high', 'legendary'
    due_date      DATE,
    position      INTEGER NOT NULL DEFAULT 0,
    is_done       BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by  UUID REFERENCES users(id),      -- NULL until completed
    completed_at  TIMESTAMPTZ,                    -- NULL until completed
    created_by    UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- TABLE: xp_ledger
-- An immutable audit log of every XP transaction.
-- Why a separate ledger? Because total_xp on the users table
-- is a DERIVED value — we can always recalculate it from the ledger.
-- Think of it like: users.total_xp is the balance shown on your
-- bank app, xp_ledger is the actual bank statement.
-- This is our safety net against XP corruption bugs.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_ledger (
    id          BIGSERIAL PRIMARY KEY,           -- fast sequential ID for ledger rows
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id     UUID REFERENCES tasks(id),       -- which task triggered this XP event
    xp_delta    INTEGER NOT NULL,                -- positive = earned, negative = penalty
    reason      VARCHAR(255) NOT NULL,           -- e.g., "task_completed", "daily_bonus"
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- SEED DATA: levels table
-- Defines the full level progression for the RPG system.
-- title: flavour name shown to the user ("You are a Knight!")
-- class_name: the mechanical class used for future ability unlocks
-- xp_required: CUMULATIVE total XP needed to reach that level
-- ─────────────────────────────────────────────
INSERT INTO levels (level_number, xp_required, title, class_name, description) VALUES
  (1,    0,     'Novice Scribe',     'Peasant',       'Every legend begins with a blank parchment.'),
  (2,    100,   'Apprentice',        'Squire',        'You have proven your worth in the tavern.'),
  (3,    250,   'Journeyman',        'Scout',         'The roads are long, but you walk them well.'),
  (4,    500,   'Adept',             'Soldier',       'Steel in your hand, fire in your heart.'),
  (5,    900,   'Veteran',           'Knight',        'Your banner is recognized across the realm.'),
  (6,    1400,  'Expert',            'Paladin',       'The light guides your blade.'),
  (7,    2100,  'Master Tactician',  'Ranger',        'You see the battlefield others cannot.'),
  (8,    3000,  'Grand Strategist',  'Mage',          'Power flows through your every decision.'),
  (9,    4200,  'Champion',          'Archmage',      'Few have reached where you now stand.'),
  (10,   6000,  'Legendary Hero',    'Grandmaster',   'Songs are sung of your deeds in every tavern.')
ON CONFLICT (level_number) DO NOTHING;


-- ─────────────────────────────────────────────
-- INDEXES
-- Why indexes? Without them, querying tasks by board is a full
-- table scan — like searching every apple in the warehouse one by
-- one instead of going directly to the "apple" shelf.
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_column_id    ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_id     ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON tasks(completed_by);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_id  ON xp_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_columns_board_id   ON columns(board_id);


-- ─────────────────────────────────────────────
-- FUNCTION + TRIGGER: auto-update updated_at timestamps
-- Why a trigger and not application code?
-- Because if someone updates a row directly in the DB (migrations,
-- admin fixes), the timestamp still updates. The DB enforces its own
-- data integrity — not dependent on every developer remembering.
-- (Dependency Inversion: DB behaviour doesn't depend on app code)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
