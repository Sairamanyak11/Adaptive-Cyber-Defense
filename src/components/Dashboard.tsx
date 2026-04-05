import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Shield, ShieldAlert, Activity, Server, LogOut, AlertTriangle, CheckCircle, XCircle, Clock, Bell, ShieldCheck, Power, Crosshair, Globe, UserX, Database } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard({ setToken, token }: { setToken: (token: string | null) => void, token: string }) {
  const [stats, setStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [threatIntel, setThreatIntel] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoDefense, setAutoDefense] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    // Fetch initial data
    fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStats(data.reverse()));

    fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setAlerts(data));

    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setAutoDefense(data.autoDefenseEnabled));

    fetch('/api/threat-intel', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setThreatIntel(data));

    // Setup WebSocket
    const socket = io();

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('system_stats', (newStat) => {
      setStats(prev => {
        const updated = [...prev, newStat];
        if (updated.length > 60) updated.shift();
        return updated;
      });
    });

    socket.on('new_alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      
      // Add to mobile/desktop toast notifications
      const toastId = Date.now();
      setToasts(prev => [...prev, { ...newAlert, toastId }]);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.toastId !== toastId));
      }, 5000);
    });

    socket.on('alert_updated', (updatedAlert) => {
      setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
    });

    socket.on('settings_updated', (data) => {
      setAutoDefense(data.autoDefenseEnabled);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleAction = async (id: number, action: string, status: string) => {
    await fetch(`/api/alerts/${id}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action, status })
    });
  };

  const toggleAutoDefense = async () => {
    const newState = !autoDefense;
    setAutoDefense(newState);
    await fetch('/api/settings/autodefense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ enabled: newState })
    });
  };

  const simulateAttack = async (type: string) => {
    setIsSimulating(true);
    try {
      await fetch('/api/simulate-attack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });
    } finally {
      setTimeout(() => setIsSimulating(false), 1000);
    }
  };

  const currentAnomalyScore = stats.length > 0 ? (stats[stats.length - 1].anomalyScore || 0) : 0;
  const systemStatus = currentAnomalyScore > 0.8 ? 'Critical' : (currentAnomalyScore > 0.5 ? 'Warning' : 'Secure');
  const statusColor = currentAnomalyScore > 0.8 ? 'text-red-500' : (currentAnomalyScore > 0.5 ? 'text-yellow-500' : 'text-emerald-500');
  const securePercentage = stats.length > 0 ? Math.max(0, Math.min(100, Math.round(100 - (currentAnomalyScore * 100)))) : 100;
  const autoBlockedCount = alerts.filter(a => a.status === 'auto-mitigated').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Adaptive Cyber Defense</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-slate-400">{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
            <button
              onClick={() => setToken(null)}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 font-medium">System Status</h3>
              <ShieldAlert className={`w-6 h-6 ${statusColor}`} />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-bold ${statusColor}`}>{systemStatus}</span>
            </div>
            <div className="mt-4 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${currentAnomalyScore > 0.8 ? 'bg-red-500' : (currentAnomalyScore > 0.5 ? 'bg-yellow-500' : 'bg-emerald-500')} transition-all duration-500`}
                style={{ width: `${Math.min(100, currentAnomalyScore * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 font-medium">Secure Percentage</h3>
              <ShieldCheck className={`w-6 h-6 ${securePercentage > 80 ? 'text-emerald-500' : securePercentage > 50 ? 'text-yellow-500' : 'text-red-500'}`} />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-bold ${securePercentage > 80 ? 'text-emerald-500' : securePercentage > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {securePercentage}%
              </span>
            </div>
            <div className="mt-4 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${securePercentage > 80 ? 'bg-emerald-500' : securePercentage > 50 ? 'bg-yellow-500' : 'bg-red-500'} transition-all duration-500`}
                style={{ width: `${securePercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 font-medium">Active Threats</h3>
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-white">
                {alerts.filter(a => a.status === 'pending').length}
              </span>
              <span className="text-sm text-slate-500">Requires Action</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 font-medium">Auto-Blocked</h3>
              <Power className={`w-6 h-6 ${autoDefense ? 'text-blue-500' : 'text-slate-600'}`} />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-white">
                {autoBlockedCount}
              </span>
              <span className="text-sm text-slate-500">Threats Mitigated</span>
            </div>
            <div className="mt-4">
              <button
                onClick={toggleAutoDefense}
                className={`w-full py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  autoDefense 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {autoDefense ? 'Auto-Defense: ON' : 'Auto-Defense: OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-medium text-white mb-6">Anomaly Score Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats}>
                  <defs>
                    <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="timestamp" tickFormatter={(tick) => format(new Date(tick), 'HH:mm:ss')} stroke="#475569" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#475569" fontSize={12} domain={[0, 1.5]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                    labelFormatter={(label) => format(new Date(label), 'HH:mm:ss')}
                  />
                  <Area type="monotone" dataKey="anomalyScore" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomaly)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-medium text-white mb-6">Resource Utilization</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="timestamp" tickFormatter={(tick) => format(new Date(tick), 'HH:mm:ss')} stroke="#475569" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#475569" fontSize={12} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                    labelFormatter={(label) => format(new Date(label), 'HH:mm:ss')}
                  />
                  <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
                  <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Advanced Capabilities Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attack Simulation Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Attack Simulation Engine</h3>
              <Crosshair className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Trigger synthetic attacks to test the RL Defense Engine and behavior profiling models.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => simulateAttack('DDoS Attack')}
                disabled={isSimulating}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-red-500/50 hover:bg-red-500/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">DDoS Attack</span>
                </div>
              </button>
              <button
                onClick={() => simulateAttack('Data Exfiltration')}
                disabled={isSimulating}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">Data Exfiltration</span>
                </div>
              </button>
              <button
                onClick={() => simulateAttack('Insider Threat')}
                disabled={isSimulating}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <UserX className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">Insider Threat</span>
                </div>
              </button>
              <button
                onClick={() => simulateAttack('Ransomware Activity')}
                disabled={isSimulating}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <Server className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">Ransomware</span>
                </div>
              </button>
            </div>
          </div>

          {/* Threat Intelligence Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Global Threat Intelligence</h3>
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {threatIntel.map((intel) => (
                <div key={intel.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${intel.reputation === 'Malicious' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                    <div>
                      <p className="text-sm font-mono text-slate-300">{intel.ip}</p>
                      <p className="text-xs text-slate-500">{intel.threat_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      intel.reputation === 'Malicious' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {intel.reputation}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{intel.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-lg font-medium text-white">Threat Intelligence Log</h3>
            <span className="bg-slate-800 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-700">
              RL Engine Active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Threat Type</th>
                  <th className="px-6 py-4 font-medium">Source IP</th>
                  <th className="px-6 py-4 font-medium">Risk Score</th>
                  <th className="px-6 py-4 font-medium">Status / Action</th>
                  <th className="px-6 py-4 font-medium text-right">Admin Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>{format(new Date(alert.timestamp), 'MMM d, HH:mm:ss')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {alert.severity === 'High' ? (
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        ) : alert.severity === 'Medium' ? (
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                        <span className="font-medium text-slate-200">{alert.event_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{alert.source_ip}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold ${alert.risk_score > 80 ? 'text-red-400' : (alert.risk_score > 50 ? 'text-yellow-400' : 'text-emerald-400')}`}>
                          {alert.risk_score}
                        </span>
                        <span className="text-xs text-slate-500">/100</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {alert.status === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                          Pending Review
                        </span>
                      ) : (
                        <div className="flex flex-col space-y-1">
                          <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            <span className="capitalize">{alert.status.replace('-', ' ')}</span>
                          </span>
                          <span className="text-xs text-slate-500">{alert.action_taken}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {alert.status === 'pending' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleAction(alert.id, 'Block IP', 'mitigated')}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            Block
                          </button>
                          <button
                            onClick={() => handleAction(alert.id, 'Ignore', 'ignored')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            Ignore
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No threats detected. System is secure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Mobile & Desktop Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.toastId}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`bg-slate-800 border-l-4 p-4 rounded-lg shadow-2xl flex items-start space-x-3 ${
                toast.severity === 'High' ? 'border-red-500' : 
                toast.severity === 'Medium' ? 'border-yellow-500' : 'border-blue-500'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Bell className={`w-5 h-5 ${
                  toast.severity === 'High' ? 'text-red-500 animate-pulse' : 
                  toast.severity === 'Medium' ? 'text-yellow-500' : 'text-blue-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">{toast.event_type}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{toast.description}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs font-mono text-slate-500">{toast.source_ip}</span>
                  <span className="text-xs text-slate-600">•</span>
                  <span className={`text-xs font-medium ${toast.risk_score > 80 ? 'text-red-400' : 'text-yellow-400'}`}>
                    Risk: {toast.risk_score}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
                className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
