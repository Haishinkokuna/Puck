// src/pages/BoardsList.jsx
// The main dashboard. Shows all boards the user is a member of.
// Allows creating new boards.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useStore from '../store/useStore';
import PlayerHUD from '../components/HUD/PlayerHUD';
import './BoardsList.css';

export default function BoardsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { boards, fetchBoards, boardLoading, createBoard, logout } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const newBoard = await createBoard(form.name, form.description);
      setShowForm(false);
      setForm({ name: '', description: '' });
      navigate(`/b/${newBoard.id}`); // Jump straight into the new board
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="boards-dashboard">
      <div className="bg-orbs" />

      <header className="dashboard-header">
        <h1 className="dashboard-title text-crystal">{t('app.name')}</h1>
        <div className="dashboard-nav-right">
          <PlayerHUD />
          <button className="btn btn-ghost" onClick={logout}>{t('auth.logout')}</button>
        </div>
      </header>

      <main className="dashboard-main relative z-10">
        <div className="dashboard-toolbar">
          <h2 className="dashboard-section-title">{t('board.myBoards')}</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + {t('board.newBoard')}
          </button>
        </div>

        {showForm && (
          <form className="new-board-form glass-panel" onSubmit={handleCreate}>
            <div className="input-group">
              <label className="input-label">{t('board.boardName')}</label>
              <input
                className="input"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('board.description')}</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <span className="spinner spinner-sm" /> : t('board.createBoard')}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        {boardLoading && boards.length === 0 ? (
          <div className="dashboard-loading"><span className="spinner" /></div>
        ) : boards.length === 0 ? (
          <div className="empty-state glass-panel">
            <span className="empty-icon">◆</span>
            <p>{t('board.noBoards')}</p>
          </div>
        ) : (
          <div className="boards-grid">
            {boards.map((board) => (
              <div
                key={board.id}
                className="board-card glass-panel glass-panel--crystal"
                onClick={() => navigate(`/b/${board.id}`)}
              >
                <div className="board-card-content">
                  <h3 className="board-card-title">{board.name}</h3>
                  {board.description && <p className="board-card-desc">{board.description}</p>}
                </div>
                <div className="board-card-footer">
                  <span className="badge badge-normal">{board.role}</span>
                  <span className="board-card-meta">{board.task_count} {t('board.tasks')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
