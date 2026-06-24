// src/routes/skillRoutes.js
const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { fetchTree, purchaseNode, equipTitle, createTree, createNode, updateNodePosition } = require('../controllers/skillController');

const router = Router();
router.use(authenticate);

// ── Skills & Profile routes ──────────────────────────
router.get('/tree', fetchTree);
router.post('/unlock/:nodeId', purchaseNode);
router.put('/title', equipTitle);

router.post('/trees', createTree);
router.post('/nodes', createNode);
router.put('/nodes/:nodeId/position', updateNodePosition);

module.exports = router;
