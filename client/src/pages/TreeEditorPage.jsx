import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import useStore from '../store/useStore';
import client from '../api/client';
import './TreeEditorPage.css';

const AVAILABLE_ICONS = [
  'Code', 'Database', 'Layout', 'Terminal', 'Server', 'Shield', 
  'Sword', 'Wand', 'Flame', 'Sparkles', 'Bug', 'Hammer', 'Scroll', 'Zap', 'Star', 'Book', 'Crown'
];

const Icon = ({ name, size = 24, className = '' }) => {
  if (!name) name = 'star';
  const iconName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  const LucideIcon = LucideIcons[iconName] || LucideIcons.Star;
  return <LucideIcon size={size} className={className} />;
};

export default function TreeEditorPage() {
  const navigate = useNavigate();
  const { skillTrees, fetchSkillTree, taskTypes, fetchTaskTypes, updateNodePosition } = useStore();
  const [activeTreeId, setActiveTreeId] = useState('');
  const [loading, setLoading] = useState(false);

  // Drag & Select state
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragPos, setDragPos] = useState(null); // {x, y}
  const [activeParentNodeId, setActiveParentNodeId] = useState(null);
  const [pendingNodePos, setPendingNodePos] = useState(null); // {x, y}
  const canvasRef = useRef(null);

  // Forms
  const [newTreeForm, setNewTreeForm] = useState({ task_type_id: '', name: '', icon_name: 'Star' });
  const [newNodeForm, setNewNodeForm] = useState({
    name: '', task_type_name: '', xp_cost: 10, icon_name: 'Star', color_hex: '#FFFFFF'
  });

  useEffect(() => {
    fetchSkillTree();
    fetchTaskTypes();
  }, []);

  useEffect(() => {
    if (skillTrees?.length > 0 && !activeTreeId) {
      setActiveTreeId(skillTrees[0].id);
    }
  }, [skillTrees, activeTreeId]);

  const activeTree = skillTrees?.find(t => t.id === activeTreeId);

  // Use global task types instead of extracting from boards
  const availableTaskTypes = taskTypes.filter(tt => !skillTrees?.some(st => st.task_type_id === tt.id));

  const handleCreateTree = async (e) => {
    e.preventDefault();
    if (!newTreeForm.task_type_id) return;
    const tt = taskTypes.find(t => t.id === newTreeForm.task_type_id);
    setLoading(true);
    try {
      const res = await client.post('/skills/trees', {
        name: newTreeForm.name || `${tt.name} Constellation`,
        task_type_id: tt.id,
        icon_name: newTreeForm.icon_name
      });
      await fetchSkillTree();
      setActiveTreeId(res.data.tree.id);
      setNewTreeForm({ task_type_id: '', name: '', icon_name: 'Star' });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!activeTreeId || !newNodeForm.name || !pendingNodePos) return;
    setLoading(true);
    try {
      await client.post('/skills/nodes', {
        ...newNodeForm,
        parent_node_id: activeParentNodeId || '',
        tree_id: activeTreeId,
        x_pos: pendingNodePos.x,
        y_pos: pendingNodePos.y
      });
      await fetchSkillTree();
      setPendingNodePos(null);
      setNewNodeForm({
        name: '', task_type_name: '', xp_cost: 10, icon_name: 'Star', color_hex: '#FFFFFF'
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // --- Canvas Interaction Logic ---
  const handleNodePointerDown = (e, node) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setDraggingNode(node.id);
  };

  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    // Set as parent for the next branch
    setActiveParentNodeId(node.id === activeParentNodeId ? null : node.id);
    setPendingNodePos(null);
  };

  const handleCanvasPointerMove = (e) => {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));
    setDragPos({ x, y });
  };

  const handleCanvasPointerUp = async (e) => {
    if (draggingNode) {
      const node = activeTree.nodes.find(n => n.id === draggingNode);
      const finalPos = dragPos || { x: node.x_pos, y: node.y_pos };
      setDraggingNode(null);
      setDragPos(null);
      if (node && dragPos) {
        await updateNodePosition(node.id, finalPos.x, finalPos.y);
      }
    }
  };

  const handleCanvasClick = (e) => {
    if (draggingNode) return; // Ignore click if we were dragging
    if (!activeTree) return;
    if (activeTree.nodes.length > 0 && !activeParentNodeId) {
      // Must select a parent first if tree is not empty
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPendingNodePos({ x, y });
  };

  const renderEdges = () => {
    if (!activeTree?.edges || !activeTree?.nodes) return null;
    return activeTree.edges.map(edge => {
      const parent = activeTree.nodes.find(n => n.id === edge.parent_node_id);
      const child = activeTree.nodes.find(n => n.id === edge.child_node_id);
      if (!parent || !child) return null;
      return (
        <line
          key={`${parent.id}-${child.id}`}
          x1={`${parent.x_pos}%`}
          y1={`${parent.y_pos}%`}
          x2={`${child.x_pos}%`}
          y2={`${child.y_pos}%`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="3"
        />
      );
    });
  };

  const renderPendingEdge = () => {
    if (!pendingNodePos || !activeParentNodeId) return null;
    const parent = activeTree.nodes.find(n => n.id === activeParentNodeId);
    if (!parent) return null;
    return (
      <line
        x1={`${parent.x_pos}%`}
        y1={`${parent.y_pos}%`}
        x2={`${pendingNodePos.x}%`}
        y2={`${pendingNodePos.y}%`}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="3"
        strokeDasharray="5,5"
      />
    );
  };

  if (!skillTrees) return <div className="spinner" style={{ margin: 'auto', marginTop: '100px' }} />;

  return (
    <div className="tree-editor-page">
      <header className="board-header">
        <div className="board-nav-left">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="board-name">Skill Tree Editor</h1>
        </div>
      </header>

      <main className="editor-main">
        {/* Left Panel: Forms */}
        <div className="editor-sidebar">
          {/* Tree Selector */}
          <div className="editor-panel glass-panel">
            <h2>Select Tree Category</h2>
            <div className="input-group">
              <select className="input" value={activeTreeId} onChange={e => {
                setActiveTreeId(e.target.value);
                setActiveParentNodeId(null);
                setPendingNodePos(null);
              }}>
                <option value="" disabled>-- Select a Tree Category --</option>
                {skillTrees.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Create Tree Form */}
          <div className="editor-panel glass-panel">
            <h2>Create New Tree Category</h2>
            <form onSubmit={handleCreateTree} className="editor-form">
              <div className="input-group">
                <label className="input-label">Task Type (Category)</label>
                <select 
                  className="input" 
                  value={newTreeForm.task_type_id}
                  onChange={e => {
                    const tt = availableTaskTypes.find(t => t.id === e.target.value);
                    setNewTreeForm({ ...newTreeForm, task_type_id: e.target.value, name: tt ? `${tt.name} Constellation` : '' });
                  }}
                >
                  <option value="">-- Select a Category --</option>
                  {availableTaskTypes.map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
                </select>
              </div>
              {newTreeForm.task_type_id && (
                <>
                  <div className="input-group">
                    <label className="input-label">Tree Name</label>
                    <input className="input" value={newTreeForm.name} onChange={e => setNewTreeForm({...newTreeForm, name: e.target.value})} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>+ Create Tree</button>
                </>
              )}
            </form>
          </div>

          {activeTree && (
            <div className="editor-panel glass-panel helper-panel">
              <h3>How to build:</h3>
              <ol className="help-list">
                {activeTree.nodes?.length === 0 ? (
                  <li><strong>Click anywhere</strong> on the canvas to place your Base Root Node.</li>
                ) : (
                  <>
                    <li><strong>Click a Node</strong> to select it as the Parent.</li>
                    <li><strong>Click empty space</strong> to place a new connected branch.</li>
                    <li><strong>Drag Nodes</strong> to reposition them.</li>
                  </>
                )}
              </ol>
            </div>
          )}
        </div>

        {/* Right Panel: Canvas */}
        <div className="editor-canvas-container glass-panel">
          {activeTree ? (
            <div 
              className="editor-canvas" 
              ref={canvasRef}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
              onClick={handleCanvasClick}
            >
              <h2 className="canvas-title">
                <Icon name={activeTree.icon_name} size={28} />
                {activeTree.name}
              </h2>
              <svg className="constellation-edges">
                {renderEdges()}
                {renderPendingEdge()}
              </svg>

              {activeTree.nodes?.map(node => {
                const isDragging = draggingNode === node.id;
                const isActiveParent = activeParentNodeId === node.id;
                const x = isDragging && dragPos ? dragPos.x : node.x_pos;
                const y = isDragging && dragPos ? dragPos.y : node.y_pos;
                
                return (
                  <div
                    key={node.id}
                    className={`skill-node draggable-node ${isDragging ? 'dragging' : ''} ${isActiveParent ? 'active-parent' : ''}`}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      '--node-color': node.color_hex
                    }}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    onClick={(e) => handleNodeClick(e, node)}
                  >
                    <div className="node-icon-wrapper" style={{ color: node.color_hex }}>
                      <Icon name={node.icon_name} size={28} />
                    </div>
                    <span className="node-label">{node.name}</span>
                  </div>
                );
              })}

              {/* Pending Node Form */}
              {pendingNodePos && (
                <div 
                  className="pending-node-popup glass-panel"
                  style={{
                    left: `${pendingNodePos.x}%`,
                    top: `${pendingNodePos.y}%`,
                  }}
                  onClick={e => e.stopPropagation()} // Prevent clicking popup from triggering canvas click
                >
                  <form onSubmit={handleCreateNode} className="pending-node-form">
                    <div className="input-group">
                      <input 
                        className="input" 
                        placeholder="Node Name" 
                        value={newNodeForm.name} 
                        onChange={e => setNewNodeForm({...newNodeForm, name: e.target.value})} 
                        autoFocus
                        required 
                      />
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <select className="input" value={newNodeForm.icon_name} onChange={e => setNewNodeForm({...newNodeForm, icon_name: e.target.value})}>
                          {AVAILABLE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <input 
                          type="number" 
                          className="input" 
                          placeholder="XP"
                          value={newNodeForm.xp_cost} 
                          onChange={e => setNewNodeForm({...newNodeForm, xp_cost: parseInt(e.target.value)})} 
                          min={0} 
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingNodePos(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>Place</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-canvas">Select or create a tree to start editing.</div>
          )}
        </div>
      </main>
    </div>
  );
}
