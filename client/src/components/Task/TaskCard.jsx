// src/components/Task/TaskCard.jsx
// A single task card on the Kanban board.
// Shows: title, priority badge, XP reward, complete button.
// When completed — glows gold, shows "done" state.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import useStore from '../../store/useStore';
import * as Icons from 'lucide-react';
import './TaskCard.css';

const PRIORITY_BADGE = {
  legendary: 'badge-legendary',
  high:      'badge-high',
  normal:    'badge-normal',
  low:       'badge-low',
};

export default function TaskCard({ task, boardId }) {
  const { t } = useTranslation();
  const { completeTask, deleteTask, showXpToast, showLevelUp } = useStore();
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    if (task.is_done || completing) return;
    setCompleting(true);
    try {
      const result = await completeTask(boardId, task.id);
      showXpToast(result.xp_awarded);
      if (result.leveled_up) showLevelUp(result.new_level);
    } catch (err) {
      console.error('Complete task failed:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('common.confirm'))) return;
    try { await deleteTask(boardId, task.id); }
    catch (err) { console.error('Delete task failed:', err); }
  };

  const TypeIcon = task.task_type?.icon_name ? (Icons[task.task_type.icon_name] || Icons.Circle) : null;
  const typeColor = task.task_type?.color_hex || 'transparent';

  return (
    <div 
      className={`task-card glass-panel ${task.is_done ? 'task-card--done' : ''} task-card--${task.priority}`}
      style={{ '--branch-color': typeColor }}
    >
      {/* Priority stripe on the left edge */}
      <div className={`task-priority-stripe priority-${task.priority}`} />

      <div className="task-content">
        {/* Header row: title + XP badge */}
        <div className="task-header">
          {TypeIcon && <TypeIcon size={16} className="task-type-icon" style={{ color: typeColor }} />}
          <h3 className={`task-title ${task.is_done ? 'task-title--done' : ''}`}>
            {task.is_done && <span className="task-checkmark">✦</span>}
            {task.title}
          </h3>
          <span className="badge badge-gold task-xp-badge">+{task.xp_reward} XP</span>
        </div>

        {/* Description */}
        {task.description && (
          <p className="task-desc">{task.description}</p>
        )}

        {/* Footer: priority + due date + actions */}
        <div className="task-footer">
          <div className="task-meta">
            <span className={`badge ${PRIORITY_BADGE[task.priority] || 'badge-normal'}`}>
              {t(`task.priorities.${task.priority}`)}
            </span>
            {task.due_date && (
              <span className="task-due">
                ⏳ {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="task-actions">
            {task.is_done ? (
              <span className="task-done-label">✦ {t('task.alreadyDone')}</span>
            ) : (
              <button
                className="btn btn-primary task-complete-btn"
                onClick={handleComplete}
                disabled={completing}
                title={t('task.completeTask')}
              >
                {completing ? <span className="spinner spinner-sm" /> : '⚔'}
                {t('task.complete')}
              </button>
            )}
            <button className="btn-icon task-delete-btn" onClick={handleDelete} title={t('task.deleteTask')}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
