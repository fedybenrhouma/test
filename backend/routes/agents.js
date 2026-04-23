const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');

// Start Agents Debate
router.post('/start', verifyToken, async (req, res) => {
  try {
    const { asset, timeframe } = req.body;
    const userId = req.user.id;

    if (!asset) {
      return res.status(400).json({ success: false, message: 'Asset is required' });
    }

    console.log(`🚀 Triggering agents for ${asset} on ${timeframe || '1h'} (User: ${userId})`);

    // Path to the python executable in the venv
    const pythonPath = path.join(__dirname, '../../agents/venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../agents/test_mas.py');

    // Spawn the process
    const pythonProcess = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        ASSET: asset,
        TIMEFRAME: timeframe || '1h',
        USER_ID: userId,
        PYTHONPATH: path.join(__dirname, '../../agents')
      },
      cwd: path.join(__dirname, '../../agents')
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Agents STDOUT: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Agents STDERR: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Agents process exited with code ${code}`);
    });

    return res.status(200).json({
      success: true,
      message: 'Agents triggered successfully. The debate has started.'
    });
  } catch (error) {
    console.error('Start agents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting agents',
      error: error.message
    });
  }
});

module.exports = router;
