import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import useStore from '../store/useStore';
import * as Icons from 'lucide-react';
import './CategoryPage.css';

const AVAILABLE_ICONS = [
  'Code', 'Database', 'Layout', 'Terminal', 'Server', 'Shield', 
  'Sword', 'Wand', 'Flame', 'Sparkles', 'Bug', 'Hammer', 'Scroll', 'Zap'
];

const DEFAULT_COLORS = [
  '#4A9EDB', '#E85D4A', '#4ADE80', '#F6C90E', '#A855F7', '#F472B6', '#94A3B8'
];

export default function CategoryPage() {
  const navigate = useNavigate();
  const { taskTypes, fetchTaskTypes } = useStore();
  const [form, setForm] = useState({ name: '', icon_name: 'Code', color_hex: '#4A9EDB' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await client.post(`/task-types`, form);
      await fetchTaskTypes();
      setForm({ ...form, name: '' }); // reset name
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteType = async (typeId) => {
    if (!confirm('Delete this task type?')) return;
    try {
      await client.delete(`/task-types/${typeId}`);
      await fetchTaskTypes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="category-page">
      <header className="board-header">
        <div className="board-nav-left">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="board-name">Manage Categories</h1>
        </div>
      </header>

      <main className="category-main">
        <div className="category-panel glass-panel">
          <h2>Create Task Type (Category)</h2>
          <p className="settings-desc">
            Categories classify your Kanban tasks. You can also build Skill Trees mapped to these categories!
          </p>

          <form className="new-type-form" onSubmit={handleCreateType}>
            <div className="input-group">
              <label className="input-label">Category Name</label>
              <input 
                className="input" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                placeholder="e.g. Frontend" 
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Icon</label>
              <div className="icon-grid">
                {AVAILABLE_ICONS.map(iconName => {
                  const IconComp = Icons[iconName] || Icons.Circle;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      className={`icon-picker-btn ${form.icon_name === iconName ? 'active' : ''}`}
                      onClick={() => setForm({...form, icon_name: iconName})}
                      title={iconName}
                    >
                      <IconComp size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Color Theme</label>
              <div className="color-grid">
                {DEFAULT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-picker-btn ${form.color_hex === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={() => setForm({...form, color_hex: color})}
                  />
                ))}
              </div>
            </div>

            <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm" /> : '+ Create Category'}
            </button>
          </form>
        </div>

        <div className="category-panel glass-panel">
          <h2>Your Categories</h2>
          <p className="settings-desc">These are available across all your boards.</p>
          <div className="task-types-list">
            {taskTypes.map(type => {
              const IconComponent = Icons[type.icon_name] || Icons.Circle;
              return (
                <div key={type.id} className="task-type-item" style={{ '--type-color': type.color_hex }}>
                  <IconComponent size={18} className="type-icon" />
                  <span className="type-name">{type.name}</span>
                  <button className="btn-icon type-delete" onClick={() => handleDeleteType(type.id)}>✕</button>
                </div>
              );
            })}
            {taskTypes.length === 0 && (
              <p className="text-muted">You haven't created any categories yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
