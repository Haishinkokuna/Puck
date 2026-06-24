import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import useStore from '../../store/useStore';
import * as Icons from 'lucide-react';
import './BoardSettingsModal.css';

// A curated list of RPG/tech icons from lucide
const AVAILABLE_ICONS = [
  'Code', 'Database', 'Layout', 'Terminal', 'Server', 'Shield', 
  'Sword', 'Wand', 'Flame', 'Sparkles', 'Bug', 'Hammer', 'Scroll', 'Zap'
];

const DEFAULT_COLORS = [
  '#4A9EDB', // Blue
  '#E85D4A', // Red
  '#4ADE80', // Green
  '#F6C90E', // Gold
  '#A855F7', // Purple
  '#F472B6', // Pink
  '#94A3B8', // Gray
];

export default function BoardSettingsModal({ board, onClose }) {
  const { t } = useTranslation();
  
  // Note: Task Types are now managed via TreeModal.jsx.
  // Board Settings could be used for editing board name/description in the future.


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel board-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('board.settings', 'Board Settings')}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <p className="text-muted">Board name and description editing coming soon.</p>
        </div>
      </div>
    </div>
  );
}
