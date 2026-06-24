// src/pages/BoardPage.jsx
// The main Kanban view — shows all columns and their tasks.
// Handles: create task form, column display, task completion.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useStore from '../store/useStore';
import TaskCard from '../components/Task/TaskCard';
import PlayerHUD from '../components/HUD/PlayerHUD';
import LevelUpModal from '../components/ui/LevelUpModal';
import BoardSettingsModal from '../components/Board/BoardSettingsModal';
import { Settings, Plus, Network, Briefcase } from 'lucide-react';
import './BoardPage.css';

export default function BoardPage() {
  const { t } = useTranslation();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { activeBoard, fetchBoard, boardLoading, createTask, logout, xpToast, user } = useStore();

  const [showTaskForm, setShowTaskForm]   = useState(null); // columnId or null
  const [taskForm, setTaskForm]           = useState({ title: '', description: '', xp_reward: 10, priority: 'normal', task_type_id: '' });
  const [submitting, setSubmitting]       = useState(false);
  const [showSettings, setShowSettings]   = useState(false);

  useEffect(() => { fetchBoard(boardId); }, [boardId]);

  const handleCreateTask = async (e, columnId) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSubmitting(true);
    try {
      await createTask(boardId, { ...taskForm, column_id: columnId, task_type_id: taskForm.task_type_id || null });
      setShowTaskForm(null);
      setTaskForm({ title: '', description: '', xp_reward: 10, priority: 'normal', task_type_id: '' });
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  if (boardLoading && !activeBoard) {
    return (
      <div className="board-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="board-page">
      <div className="bg-orbs" />

      {/* Top navigation bar */}
      <header className="board-header">
        <div className="board-nav-left">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('board.myBoards')}</button>
          <h1 className="board-name">{activeBoard?.name}</h1>
          <div className="board-top-actions" style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/categories')}>
              <Briefcase size={16} style={{ marginRight: '6px' }} />
              Categories
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/trees')}>
              <Network size={16} style={{ marginRight: '6px' }} />
              Tree
            </button>
          </div>
        </div>
        <div className="board-nav-right">
          <PlayerHUD />
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)} title="Board Settings">
            <Settings size={20} />
          </button>
          <button className="btn btn-ghost" onClick={logout}>{t('auth.logout')}</button>
        </div>
      </header>

      {/* XP Toast notification */}
      {xpToast && (
        <div className="toast">
          <div className="toast-item toast-xp">
            ✦ +{xpToast} XP {t('task.complete')}d!
          </div>
        </div>
      )}

      {/* Level-up modal — rendered over everything */}
      <LevelUpModal />

      {/* Modals */}
      {showSettings && <BoardSettingsModal board={activeBoard} onClose={() => setShowSettings(false)} />}

      {/* Kanban columns */}
      <main className="board-columns">
        {activeBoard?.columns?.map((column) => (
          <div key={column.id} className="kanban-column glass-panel">
            {/* Column header */}
            <div className="column-header">
              <h2 className="column-title">{column.name}</h2>
              <span className="column-count badge badge-crystal">
                {column.tasks?.length || 0}
              </span>
            </div>

            <div className="divider" />

            {/* Task list */}
            <div className="column-tasks">
              {column.tasks?.length === 0 && (
                <div className="column-empty">
                  <span>◆</span>
                  <p>No quests here</p>
                </div>
              )}
              {column.tasks?.map((task) => (
                <TaskCard key={task.id} task={task} boardId={boardId} />
              ))}
            </div>

            {/* Add task */}
            {showTaskForm === column.id ? (
              <form className="task-form glass-panel" onSubmit={(e) => handleCreateTask(e, column.id)}>
                <input
                  className="input"
                  placeholder={t('task.taskTitle')}
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  autoFocus required
                />
                <textarea
                  className="input task-form-desc"
                  placeholder={t('task.taskDesc')}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={2}
                />
                <div className="task-form-row">
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">{t('task.xpReward')}</label>
                    <input
                      className="input"
                      type="number"
                      min={1} max={1000}
                      value={taskForm.xp_reward}
                      onChange={(e) => setTaskForm({ ...taskForm, xp_reward: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">{t('task.priority')}</label>
                    <select
                      className="input"
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    >
                      <option value="low">{t('task.priorities.low')}</option>
                      <option value="normal">{t('task.priorities.normal')}</option>
                      <option value="high">{t('task.priorities.high')}</option>
                      <option value="legendary">{t('task.priorities.legendary')}</option>
                    </select>
                  </div>
                </div>

                {/* Task Type Selection */}
                <div className="task-form-row">
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Category (Task Type)</label>
                    <select
                      className="input"
                      value={taskForm.task_type_id}
                      onChange={(e) => setTaskForm({ ...taskForm, task_type_id: e.target.value })}
                    >
                      <option value="">None (Add in Category)</option>
                      {activeBoard?.task_types?.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="task-form-actions">
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? <span className="spinner spinner-sm" /> : t('task.createTask')}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => setShowTaskForm(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button className="add-task-btn" onClick={() => setShowTaskForm(column.id)}>
                + {t('task.newTask')}
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
