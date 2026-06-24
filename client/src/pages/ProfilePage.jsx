import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import useStore from '../store/useStore';
import './ProfilePage.css';

// Helper to render lucide icons dynamically by name
const Icon = ({ name, size = 24, className = '' }) => {
  // Convert something like 'globe' to 'Globe' or 'sword' to 'Sword'
  if (!name) name = 'star';
  const iconName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  const LucideIcon = LucideIcons[iconName] || LucideIcons.Star;
  return <LucideIcon size={size} className={className} />;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { skillTrees, userStats, fetchSkillTree, purchaseSkillNode, equipTitle } = useStore();
  const [activeTreeId, setActiveTreeId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSkillTree();
  }, []);

  useEffect(() => {
    if (skillTrees?.length > 0 && !activeTreeId) {
      setActiveTreeId(skillTrees[0].id);
    }
  }, [skillTrees, activeTreeId]);

  if (!skillTrees || skillTrees.length === 0 || !userStats) {
    return (
      <div className="profile-page loading">
        <div className="spinner" />
      </div>
    );
  }

  const activeTree = skillTrees.find(t => t.id === activeTreeId) || skillTrees[0];

  // Draw SVG lines for edges
  const renderEdges = () => {
    if (!activeTree.edges || !activeTree.nodes) return null;
    return activeTree.edges.map(edge => {
      const parent = activeTree.nodes.find(n => n.id === edge.parent_node_id);
      const child = activeTree.nodes.find(n => n.id === edge.child_node_id);
      if (!parent || !child) return null;
      
      const isUnlocked = child.is_unlocked;
      // Default fullstack tree edges are white if unlocked. Faint white if locked.
      const strokeColor = isUnlocked ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)';

      return (
        <line
          key={`${parent.id}-${child.id}`}
          x1={`${parent.x_pos}%`}
          y1={`${parent.y_pos}%`}
          x2={`${child.x_pos}%`}
          y2={`${child.y_pos}%`}
          stroke={strokeColor}
          strokeWidth="3"
        />
      );
    });
  };

  const handlePurchase = async () => {
    if (!selectedNode || actionLoading) return;
    setActionLoading(true);
    try {
      await purchaseSkillNode(selectedNode.id, true);
      // Auto deselect or keep it selected to show it's unlocked
      setSelectedNode(prev => ({ ...prev, is_unlocked: true }));
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEquip = async () => {
    if (!selectedNode || actionLoading) return;
    setActionLoading(true);
    try {
      await equipTitle(selectedNode.name);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="bg-orbs" />
      
      <header className="board-header">
        <div className="board-nav-left">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="board-name">Profile & Skills</h1>
        </div>
        <div className="board-nav-right">
          <div className="xp-wallet glass-panel glass-panel--gold">
            <span className="wallet-label">Available XP</span>
            <span className="wallet-amount">{userStats.available_xp} ✦</span>
          </div>
        </div>
      </header>

      <main className="profile-main">
        {/* Tree Selector Panel */}
        <div className="tree-selector-panel glass-panel">
          <h3 className="tree-selector-title">Skill Trees</h3>
          <div className="tree-list">
            {skillTrees.map(tree => (
              <button 
                key={tree.id} 
                className={`tree-tab ${tree.id === activeTreeId ? 'active' : ''}`}
                onClick={() => { setActiveTreeId(tree.id); setSelectedNode(null); }}
              >
                <Icon name={tree.icon_name} size={18} />
                <span>{tree.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The Skill Tree / Constellation */}
        <div className="constellation-container glass-panel">
          <h2 className="tree-title">
            <Icon name={activeTree.icon_name} size={28} className="tree-title-icon" />
            {activeTree.name}
          </h2>
          
          <div className="constellation-canvas">
            <svg className="constellation-edges">
              {renderEdges()}
            </svg>

            {activeTree.nodes.map(node => (
              <div
                key={node.id}
                className={`skill-node ${node.is_unlocked ? 'unlocked' : 'locked'} ${selectedNode?.id === node.id ? 'selected' : ''}`}
                style={{
                  left: `${node.x_pos}%`,
                  top: `${node.y_pos}%`,
                  '--node-color': node.color_hex
                }}
                onClick={() => setSelectedNode(node)}
              >
                <div className="node-icon-wrapper" style={{ color: node.is_unlocked ? node.color_hex : 'rgba(255,255,255,0.3)' }}>
                  <Icon name={node.icon_name} size={28} />
                </div>
                <span className="node-label">{node.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Node Details Panel */}
        <div className="node-details-panel glass-panel">
          {selectedNode ? (
            <div className="node-details-content">
              <h3 style={{ color: selectedNode.color_hex }}>{selectedNode.name}</h3>
              {selectedNode.task_type_name && (
                <div className="node-category badge" style={{ marginBottom: '12px', display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  Task Type: {selectedNode.task_type_name}
                </div>
              )}
              <p className="node-desc">{selectedNode.description}</p>
              
              <div className="node-status">
                {selectedNode.is_unlocked ? (
                  <div className="status-unlocked">
                    <span className="badge badge-success">Unlocked</span>
                  </div>
                ) : (
                  <div className="status-locked">
                    <span className="cost">Cost: {selectedNode.xp_cost} XP</span>
                  </div>
                )}
              </div>

              <div className="divider" />

              <div className="node-actions">
                {!selectedNode.is_unlocked && (
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={handlePurchase}
                    disabled={actionLoading || userStats.available_xp < selectedNode.xp_cost}
                  >
                    {actionLoading ? 'Unlocking...' : `Unlock Title (${selectedNode.xp_cost} XP)`}
                  </button>
                )}
                {selectedNode.is_unlocked && userStats.active_title !== selectedNode.name && (
                  <button 
                    className="btn btn-ghost w-full" 
                    onClick={handleEquip}
                    disabled={actionLoading}
                  >
                    Equip Title
                  </button>
                )}
                {selectedNode.is_unlocked && userStats.active_title === selectedNode.name && (
                  <div className="text-gold text-center">Currently Equipped</div>
                )}
              </div>
            </div>
          ) : (
            <div className="node-details-empty">
              Select a star in the constellation to view its details.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
