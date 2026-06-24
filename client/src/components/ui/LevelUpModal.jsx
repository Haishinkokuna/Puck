// src/components/ui/LevelUpModal.jsx
// The most dramatic UI component — fires when the user levels up.
// Shows the new level, title, and class with full KH2-style presentation.
import { useTranslation } from 'react-i18next';
import useStore from '../../store/useStore';
import './LevelUpModal.css';

export default function LevelUpModal() {
  const { t } = useTranslation();
  const levelUpData = useStore((s) => s.levelUpData);
  const clearLevelUp = useStore((s) => s.clearLevelUp);
  const user = useStore((s) => s.user);

  if (!levelUpData) return null;

  return (
    <div className="modal-overlay" onClick={clearLevelUp}>
      <div className="modal glass-panel glass-panel--crystal levelup-modal" onClick={(e) => e.stopPropagation()}>
        {/* Animated crystal rings */}
        <div className="levelup-rings">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
        </div>

        <div className="levelup-content">
          {/* Level number — big and bold */}
          <div className="levelup-badge level-badge" style={{ width: 80, height: 80 }}>
            <span className="level-num" style={{ fontSize: '1.8rem' }}>{levelUpData.level_number}</span>
            <span className="level-label">{t('hud.level')}</span>
          </div>

          <h2 className="levelup-title text-crystal">{t('levelUp.title')}</h2>

          <div className="levelup-divider">
            <span className="levelup-diamond">◆ ◆ ◆</span>
          </div>

          <p className="levelup-you-are">{t('levelUp.youAreNow')}</p>
          <h3 className="levelup-new-title text-gold">{levelUpData.title}</h3>
          <p className="levelup-class">
            {t('levelUp.newClass')}: <strong style={{ color: 'var(--aqua)' }}>{levelUpData.class_name}</strong>
          </p>

          {user && (
            <p className="levelup-xp">
              {t('hud.totalXp')}: <span className="text-gold">{user.total_xp?.toLocaleString()} XP</span>
            </p>
          )}

          <button className="btn btn-primary levelup-btn" onClick={clearLevelUp}>
            ◆ {t('levelUp.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
