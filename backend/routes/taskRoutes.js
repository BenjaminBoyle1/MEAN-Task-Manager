const express = require('express');
const Task = require('../models/Task');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const tasks = await Task.find().sort({ scheduledFor: 1, createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      description = '',
      status = 'Pending',
      priority = 'Medium',
      scheduledFor,
      durationMinutes,
    } = req.body;

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      scheduledFor,
      durationMinutes,
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description = '',
      status,
      priority,
      scheduledFor,
      durationMinutes,
    } = req.body;

    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { title, description, status, priority, scheduledFor, durationMinutes },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/complete', async (req, res, next) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { status: 'Done' },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
