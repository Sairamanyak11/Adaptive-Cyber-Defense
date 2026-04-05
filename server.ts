import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

let autoDefenseEnabled = true;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new Database('cyberdefense.db');

// Setup Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_ip TEXT,
    event_type TEXT,
    severity TEXT,
    description TEXT,
    risk_score REAL,
    action_taken TEXT,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS system_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage REAL,
    memory_usage REAL,
    network_traffic REAL,
    active_connections INTEGER,
    anomaly_score REAL
  );
`);

// Seed Admin User
const seedAdmin = () => {
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }
};
seedAdmin();

// Authentication Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: user.role });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/alerts', authenticateToken, (req, res) => {
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 100').all();
  res.json(alerts);
});

app.post('/api/alerts/:id/action', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { action, status } = req.body;
  
  db.prepare('UPDATE alerts SET action_taken = ?, status = ? WHERE id = ?').run(action, status, id);
  
  const updatedAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
  io.emit('alert_updated', updatedAlert);
  
  res.json({ success: true });
});

app.get('/api/stats', authenticateToken, (req, res) => {
  const stats = db.prepare('SELECT * FROM system_stats ORDER BY timestamp DESC LIMIT 60').all();
  const mappedStats = stats.map((s: any) => ({
    cpu: s.cpu_usage,
    memory: s.memory_usage,
    network: s.network_traffic,
    connections: s.active_connections,
    anomalyScore: s.anomaly_score,
    timestamp: s.timestamp
  }));
  res.json(mappedStats);
});

app.get('/api/settings', authenticateToken, (req, res) => {
  res.json({ autoDefenseEnabled });
});

app.post('/api/settings/autodefense', authenticateToken, (req, res) => {
  autoDefenseEnabled = req.body.enabled;
  io.emit('settings_updated', { autoDefenseEnabled });
  res.json({ success: true, autoDefenseEnabled });
});

app.post('/api/simulate-attack', authenticateToken, (req, res) => {
  const { type } = req.body;
  
  // Spike system stats
  const cpu = 95 + Math.random() * 5;
  const memory = 90 + Math.random() * 10;
  const network = 800 + Math.random() * 500;
  const connections = 300 + Math.floor(Math.random() * 200);
  const anomalyScore = 0.95 + Math.random() * 0.05;
  
  db.prepare('INSERT INTO system_stats (cpu_usage, memory_usage, network_traffic, active_connections, anomaly_score) VALUES (?, ?, ?, ?, ?)').run(cpu, memory, network, connections, anomalyScore);
  io.emit('system_stats', { cpu, memory, network, connections, anomalyScore, timestamp: new Date().toISOString() });

  // Generate Alert
  let autoAction = 'None';
  let status = 'pending';
  const riskScore = 95 + Math.floor(Math.random() * 5);
  
  if (autoDefenseEnabled) {
    autoAction = type.includes('Insider') ? 'Quarantine Session' : 'Block IP';
    status = 'auto-mitigated';
  }

  const result = db.prepare('INSERT INTO alerts (source_ip, event_type, severity, description, risk_score, action_taken, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    `192.168.1.${Math.floor(Math.random() * 255)}`,
    type,
    'High',
    `[SIMULATION] Detected critical behavior matching ${type}.`,
    riskScore,
    autoAction,
    status
  );

  const newAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
  io.emit('new_alert', newAlert);

  res.json({ success: true, message: `Simulated ${type}` });
});

const threatIntelFeeds = [
  { id: 1, ip: '185.15.59.224', reputation: 'Malicious', source: 'AlienVault OTX', threat_type: 'Botnet C&C' },
  { id: 2, ip: '45.134.144.120', reputation: 'Suspicious', source: 'CrowdStrike', threat_type: 'Scanning IP' },
  { id: 3, ip: '193.142.146.35', reputation: 'Malicious', source: 'FireEye', threat_type: 'Ransomware Node' },
  { id: 4, ip: '103.45.67.89', reputation: 'Malicious', source: 'IBM X-Force', threat_type: 'DDoS Origin' }
];

app.get('/api/threat-intel', authenticateToken, (req, res) => {
  res.json(threatIntelFeeds);
});

// Simulated Threat Detection & RL Engine
const simulateActivity = () => {
  const cpu = 30 + Math.random() * 40;
  const memory = 40 + Math.random() * 30;
  const network = 100 + Math.random() * 500;
  const connections = 50 + Math.floor(Math.random() * 100);
  
  // Simple anomaly detection logic
  let anomalyScore = 0;
  if (cpu > 85) anomalyScore += 0.3;
  if (network > 500) anomalyScore += 0.4;
  if (connections > 120) anomalyScore += 0.3;
  
  db.prepare('INSERT INTO system_stats (cpu_usage, memory_usage, network_traffic, active_connections, anomaly_score) VALUES (?, ?, ?, ?, ?)').run(cpu, memory, network, connections, anomalyScore);
  
  const currentStats = { cpu, memory, network, connections, anomalyScore, timestamp: new Date().toISOString() };
  io.emit('system_stats', currentStats);

  // Generate Alert if anomaly is high
  if (anomalyScore > 0.6 || Math.random() > 0.95) {
    const eventTypes = ['Unauthorized Access Attempt', 'DDoS Pattern Detected', 'Suspicious Data Exfiltration', 'Malware Signature Match'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const severity = anomalyScore > 0.8 ? 'High' : (anomalyScore > 0.5 ? 'Medium' : 'Low');
    const riskScore = Math.min(100, Math.floor((anomalyScore + Math.random() * 0.5) * 100));
    
    // RL Engine simulated action
    let autoAction = 'None';
    let status = 'pending';
    
    if (autoDefenseEnabled) {
      if (riskScore > 85) {
        autoAction = 'Block IP';
        status = 'auto-mitigated';
      } else if (riskScore > 60) {
        autoAction = 'Quarantine Session';
        status = 'auto-mitigated';
      }
    }

    const result = db.prepare('INSERT INTO alerts (source_ip, event_type, severity, description, risk_score, action_taken, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      `192.168.1.${Math.floor(Math.random() * 255)}`,
      eventType,
      severity,
      `Detected unusual behavior matching ${eventType.toLowerCase()}.`,
      riskScore,
      autoAction,
      status
    );

    const newAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
    io.emit('new_alert', newAlert);
  }
};

// Run simulation every 5 seconds
setInterval(simulateActivity, 5000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
