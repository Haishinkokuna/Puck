// src/components/HUD/PlayerHUD.jsx
// The RPG status bar at the top of the app.
// Shows: level badge, title/class, XP progress bar, XP numbers.
// This is the most "Kingdom Hearts" element of the whole UI.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import './PlayerHUD.css';

export default function PlayerHUD() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  if (!user) return null;

  const xpThisLevel = user.xp_this_level || 0;
  const nextLevelXp = user.next_level_xp || 100;
  const totalXp     = user.total_xp || 0;

  // Calculate progress percentage within the CURRENT level bracket
  // e.g. if level needs 900 XP to reach and next needs 1400, and user has 950:
  // progress = (950 - 900) / (1400 - 900) = 50 / 500 = 10%
  const xpIntoLevel   = Math.max(0, totalXp - xpThisLevel);
  const xpRangeInLevel = Math.max(1, nextLevelXp - xpThisLevel);
  const progressPct   = Math.min(100, Math.round((xpIntoLevel / xpRangeInLevel) * 100));
  const xpToNext      = Math.max(0, nextLevelXp - totalXp);

  return (
    <div className="player-hud glass-panel glass-panel--gold" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="View Profile">
      {/* Level badge — the circular gold level display */}
      <div className="level-badge">
        <span className="level-num">{user.level || 1}</span>
        <span className="level-label">{t('hud.level')}</span>
      </div>

      {/* Title and class info */}
      <div className="hud-identity">
        <div className="hud-username">{user.username}</div>
        <div className="hud-title text-gold">{user.active_title || user.title}</div>
        <div className="hud-class">{user.class_name}</div>
      </div>

      {/* XP bar section */}
      <div className="hud-xp-section">
        <div className="hud-xp-labels">
          <span className="hud-xp-current">{totalXp.toLocaleString()} XP</span>
          <span className="hud-xp-next">{xpToNext > 0 ? `${xpToNext} ${t('hud.xpToNext')}` : '✦ MAX ✦'}</span>
        </div>
        <div className="xp-bar-container">
          <div className="xp-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="hud-progress-pct">{progressPct}%</div>
      </div>
    </div>
  );
}
