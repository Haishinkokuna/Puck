// src/store/useStore.js
// Zustand global store — the app's shared memory.
// Why Zustand over Redux? 
// Zustand is 1/10th the boilerplate with the same power for our scale.
// No actions, no reducers, no dispatch — just functions that set state.
// The whole store fits in one file that's easy to read top to bottom.
import { create } from 'zustand';
import client from '../api/client';

const useStore = create((set, get) => ({

  // ── AUTH STATE ─────────────────────────────────────────────
  // User is loaded from localStorage on first visit so sessions persist
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,

  setUser: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null, boards: [], activeBoard: null });
  },

  // Update user XP and level after a task completion — no re-fetch needed
  updateUserXP: (newTotalXp, newLevel) => {
    const user = get().user;
    if (!user) return;
    const updated = {
      ...user,
      total_xp: newTotalXp,
      ...(newLevel && {
        level:      newLevel.level_number,
        title:      newLevel.title,
        class_name: newLevel.class_name,
      }),
    };
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },

  // ── BOARDS STATE ───────────────────────────────────────────
  boards:      [],
  activeBoard: null,
  boardLoading: false,

  fetchBoards: async () => {
    set({ boardLoading: true });
    try {
      const res = await client.get('/boards');
      set({ boards: res.data.boards });
    } finally {
      set({ boardLoading: false });
    }
  },

  fetchBoard: async (boardId) => {
    set({ boardLoading: true });
    try {
      const res = await client.get(`/boards/${boardId}`);
      set({ activeBoard: res.data.board });
    } finally {
      set({ boardLoading: false });
    }
  },

  createBoard: async (name, description) => {
    const res = await client.post('/boards', { name, description });
    set((state) => ({ boards: [res.data.board, ...state.boards] }));
    return res.data.board;
  },

  // ── TASK OPERATIONS ────────────────────────────────────────
  createTask: async (boardId, taskData) => {
    const res = await client.post(`/boards/${boardId}/tasks`, taskData);
    // Add the new task to the correct column in the activeBoard without re-fetching
    set((state) => {
      if (!state.activeBoard) return {};
      const columns = state.activeBoard.columns.map((col) => {
        if (col.id === taskData.column_id) {
          return { ...col, tasks: [...col.tasks, res.data.task] };
        }
        return col;
      });
      return { activeBoard: { ...state.activeBoard, columns } };
    });
    return res.data.task;
  },

  moveTask: async (boardId, taskId, newColumnId, newPosition) => {
    await client.patch(`/boards/${boardId}/tasks/${taskId}`, {
      column_id: newColumnId,
      position:  newPosition,
    });
    // Optimistic update — move task in local state immediately without waiting for API
    // This makes drag-and-drop feel instant.
    set((state) => {
      if (!state.activeBoard) return {};
      let movedTask = null;
      const columns = state.activeBoard.columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => {
          if (t.id === taskId) { movedTask = t; return false; }
          return true;
        }),
      })).map((col) => {
        if (col.id === newColumnId && movedTask) {
          const newTasks = [...col.tasks];
          newTasks.splice(newPosition, 0, { ...movedTask, column_id: newColumnId });
          return { ...col, tasks: newTasks };
        }
        return col;
      });
      return { activeBoard: { ...state.activeBoard, columns } };
    });
  },

  completeTask: async (boardId, taskId) => {
    const res = await client.post(`/boards/${boardId}/tasks/${taskId}/complete`);
    // Mark the task as done in local state
    set((state) => {
      if (!state.activeBoard) return {};
      const columns = state.activeBoard.columns.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) =>
          t.id === taskId ? { ...t, is_done: true } : t
        ),
      }));
      return { activeBoard: { ...state.activeBoard, columns } };
    });
    // Update the user's XP and level in the HUD
    get().updateUserXP(res.data.new_total_xp, res.data.new_level);
    return res.data; // { xp_awarded, new_total_xp, leveled_up, new_level }
  },

  deleteTask: async (boardId, taskId) => {
    await client.delete(`/boards/${boardId}/tasks/${taskId}`);
    set((state) => {
      if (!state.activeBoard) return {};
      const columns = state.activeBoard.columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
      }));
      return { activeBoard: { ...state.activeBoard, columns } };
    });
  },

  // ── UI STATE ───────────────────────────────────────────────
  levelUpData:    null,  // set when leveled_up === true, triggers modal
  xpToast:        null,  // set when XP is awarded, triggers toast notification
  skillTrees:     null,
  userStats:      null,

  showLevelUp: (data) => set({ levelUpData: data }),
  dismissLevelUp: () => set({ levelUpData: null }),

  fetchSkillTree: async () => {
    try {
      const res = await client.get('/skills/tree');
      set({ skillTrees: res.data.trees, userStats: res.data.user_stats });
    } catch (err) {
      console.error('Failed to fetch skill tree', err);
    }
  },

  // ── TASK TYPES STATE ───────────────────────────────────────
  taskTypes: [],

  fetchTaskTypes: async () => {
    try {
      const res = await client.get('/task-types');
      set({ taskTypes: res.data });
    } catch (err) {
      console.error('Failed to fetch task types', err);
    }
  },

  purchaseSkillNode: async (nodeId, equip) => {
    try {
      const res = await client.post(`/skills/unlock/${nodeId}`, { equip });
      // Refresh the tree after unlocking
      await get().fetchSkillTree();
      
      // Update local user active title if equipped
      if (equip) {
        set({ user: { ...get().user, active_title: res.data.newTitle } });
      }
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  updateNodePosition: async (nodeId, x_pos, y_pos) => {
    try {
      const { data } = await client.put(`/skills/nodes/${nodeId}/position`, { x_pos, y_pos });
      set(state => {
        const newTrees = state.skillTrees.map(tree => {
          return {
            ...tree,
            nodes: tree.nodes.map(n => n.id === nodeId ? { ...n, x_pos, y_pos } : n)
          };
        });
        return { skillTrees: newTrees };
      });
    } catch (err) {
      console.error(err);
    }
  },

  equipTitle: async (title) => {
    try {
      await client.put('/skills/title', { title });
      set({ user: { ...get().user, active_title: title } });
      await get().fetchSkillTree();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  showXpToast: (xp)  => {
    set({ xpToast: xp });
    setTimeout(() => set({ xpToast: null }), 3500);
  },
}));

export default useStore;
