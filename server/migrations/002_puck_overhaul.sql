-- migrations/002_puck_overhaul.sql
-- RPG Overhaul: Task Types and Skill Trees

-- 1. Create task_types table
CREATE TABLE IF NOT EXISTS task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon_name VARCHAR(50) DEFAULT 'circle',
    color_hex VARCHAR(7) DEFAULT '#4A9EDB',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Modify tasks table to include task_type_id
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES task_types(id) ON DELETE SET NULL;

-- 3. Create skill_trees table
CREATE TABLE IF NOT EXISTS skill_trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create skill_nodes table
CREATE TABLE IF NOT EXISTS skill_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id UUID NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- This is the Title granted (e.g., "Novice Scribe")
    description TEXT,
    xp_cost INT NOT NULL DEFAULT 100,
    x_pos FLOAT NOT NULL DEFAULT 0, -- Percentage 0-100 for visual layout (X axis)
    y_pos FLOAT NOT NULL DEFAULT 0, -- Percentage 0-100 for visual layout (Y axis)
    color_hex VARCHAR(7) DEFAULT '#F6C90E', -- Base color for the star
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create skill_edges (prerequisites)
CREATE TABLE IF NOT EXISTS skill_edges (
    parent_node_id UUID NOT NULL REFERENCES skill_nodes(id) ON DELETE CASCADE,
    child_node_id UUID NOT NULL REFERENCES skill_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_node_id, child_node_id)
);

-- 6. Create user_unlocked_nodes table
CREATE TABLE IF NOT EXISTS user_unlocked_nodes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES skill_nodes(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, node_id)
);

-- 7. Seed the default "Fullstack Constellation" skill tree
-- We use a DO block to seed initial data safely
DO $$
DECLARE
    v_tree_id UUID;
    v_root_id UUID;
    v_fe1_id UUID;
    v_be1_id UUID;
    v_fe2_id UUID;
    v_be2_id UUID;
    v_master_id UUID;
BEGIN
    -- Check if default tree already exists
    IF NOT EXISTS (SELECT 1 FROM skill_trees WHERE is_default = true) THEN
        INSERT INTO skill_trees (name, description, is_default)
        VALUES ('Fullstack Constellation', 'The grand path of the modern developer.', true)
        RETURNING id INTO v_tree_id;

        -- Create Root Node (Apprentice)
        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'Apprentice', 'The journey begins.', 0, 50, 90, '#FFFFFF')
        RETURNING id INTO v_root_id;

        -- Create Frontend Branch (Blue)
        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'DOM Weaver', 'Mastery over the Document Object Model.', 100, 30, 70, '#4A9EDB')
        RETURNING id INTO v_fe1_id;

        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'React Sorcerer', 'Harness the power of components.', 200, 20, 45, '#4A9EDB')
        RETURNING id INTO v_fe2_id;

        -- Create Backend Branch (Red)
        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'Query Slayer', 'Bane of unoptimized SQL.', 100, 70, 70, '#E85D4A')
        RETURNING id INTO v_be1_id;

        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'Node Architect', 'Builder of robust server realms.', 200, 80, 45, '#E85D4A')
        RETURNING id INTO v_be2_id;

        -- Create Master Node (Gold)
        INSERT INTO skill_nodes (tree_id, name, description, xp_cost, x_pos, y_pos, color_hex)
        VALUES (v_tree_id, 'Puck Grandmaster', 'A true Fullstack legend.', 500, 50, 20, '#F6C90E')
        RETURNING id INTO v_master_id;

        -- Create Edges (Connections/Prerequisites)
        -- Root -> FE1 & BE1
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_root_id, v_fe1_id);
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_root_id, v_be1_id);

        -- FE1 -> FE2
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_fe1_id, v_fe2_id);

        -- BE1 -> BE2
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_be1_id, v_be2_id);

        -- FE2 & BE2 -> Master
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_fe2_id, v_master_id);
        INSERT INTO skill_edges (parent_node_id, child_node_id) VALUES (v_be2_id, v_master_id);
    END IF;
END $$;
