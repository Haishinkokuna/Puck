const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getTaskTypes, createTaskType, deleteTaskType } = require('../controllers/taskTypeController');

const router = Router();
router.use(authenticate);

router.get('/', getTaskTypes);
router.post('/', createTaskType);
router.delete('/:typeId', deleteTaskType);

module.exports = router;
