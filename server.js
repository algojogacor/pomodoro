import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Turso client
const turso = createClient({
  url: 'libsql://pomodoro-aryariap.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk5MTQwOTQsImlkIjoiMDFhMGJmMzEtNzUwMS03MTYzLWI5NTQtODM2ODJkMmRjNGI2Iiwia2lkIjoiUm9jbEg5WTdsbnBBLXEycnpydUZSUko0TWNvZGFYYzVWd0VYNWpLcnU2WSIsInJpZCI6IjQxMDg5YzFjLTQxNTYtNDY3Ny1iYjNhLTFlN2MzYmFhYzA2NSJ9.WP33COjzQA1ggWPifhXPLisTr_hlX8_8wId-Y5P_vVsHagZPErZVTFy6ODWjAFmQbrJadkcNwyD0xqmFMATOCg'
});

// Initialize database table
await turso.execute(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    duration INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Get today's statistics
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await turso.execute(`
      SELECT 
        mode,
        COUNT(*) as count,
        SUM(duration) as total_duration
      FROM sessions
      WHERE DATE(completed_at) = '${today}'
      GROUP BY mode
    `);
    
    const stats = {
      focus: { count: 0, totalDuration: 0 },
      'short-break': { count: 0, totalDuration: 0 },
      'long-break': { count: 0, totalDuration: 0 }
    };
    
    result.rows.forEach(row => {
      stats[row.mode] = {
        count: row.count,
        totalDuration: row.total_duration
      };
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Record a completed session
app.post('/api/session', async (req, res) => {
  try {
    const { mode, duration } = req.body;
    await turso.execute({
      sql: 'INSERT INTO sessions (mode, duration) VALUES (?, ?)',
      args: [mode, duration]
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording session:', error);
    res.status(500).json({ error: 'Failed to record session' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
