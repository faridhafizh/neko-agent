"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  fetchSystemMetrics,
  fetchSystemMetricsHistory,
  subscribeSystemMetrics,
  SystemMetrics,
} from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { 
  Activity, 
  Cpu, 
  Database, 
  HardDrive, 
  Globe, 
  ArrowLeft, 
  RefreshCw,
  Clock,
  Info,
  Zap
} from "lucide-react";

export default function MonitorPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState("1h");

  // Load initial history
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await fetchSystemMetricsHistory(50, selectedTimeRange);
        setHistory(data.history);
        if (data.history.length > 0) {
          setMetrics(data.history[data.history.length - 1]);
        }
        setLoading(false);
      } catch (e) {
        console.error("Failed to load initial metrics:", e);
        setLoading(false);
      }
    };
    loadInitialData();
  }, [selectedTimeRange]);

  // Subscribe to live metrics via WebSocket
  useEffect(() => {
    if (!isLive) return;

    const unsubscribe = subscribeSystemMetrics((newMetrics) => {
      setMetrics(newMetrics);
      setHistory((prev) => {
        const newHistory = [...prev, newMetrics];
        // Keep last 100 points for the chart
        if (newHistory.length > 100) return newHistory.slice(1);
        return newHistory;
      });
    });

    return () => unsubscribe();
  }, [isLive]);

  const chartData = useMemo(() => {
    return history.map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpu: m.cpu.overall,
      memory: m.memory.usage,
      download: m.network.bandwidth.download,
      upload: m.network.bandwidth.upload,
    }));
  }, [history]);

  const formatBytes = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getStatusColor = (usage: number): string => {
    if (usage < 50) return "text-emerald-400";
    if (usage < 80) return "text-amber-400";
    return "text-rose-400";
  };

  const getProgressColor = (usage: number): string => {
    if (usage < 50) return "bg-emerald-500";
    if (usage < 80) return "bg-amber-500";
    return "bg-rose-500";
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-amber-500">
            <RefreshCw size={40} />
          </div>
          <p className="text-stone-400 font-medium">Initializing Neko Monitor...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-950 text-stone-500">
        <div className="text-center max-w-md p-8 bg-stone-900 rounded-3xl border border-stone-800">
          <Activity size={64} className="mx-auto mb-6 text-stone-700" />
          <h2 className="text-2xl font-bold text-stone-200 mb-2">Metrics Unavailable</h2>
          <p className="mb-6">We couldn't connect to the system agent. Please ensure the backend is running.</p>
          <button 
            onClick={() => router.refresh()}
            className="px-6 py-2 bg-amber-500 text-white rounded-full hover:bg-amber-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-stone-950 text-stone-200 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-stone-900/50 backdrop-blur-md border-b border-stone-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Activity className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              System <span className="text-amber-500">Monitor</span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-stone-600'}`} />
              {isLive ? 'Live Connection Active' : 'Updates Paused'} • {metrics.uptime} uptime
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-stone-800 rounded-full p-1 mr-2">
            <button 
              onClick={() => setIsLive(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isLive ? 'bg-amber-500 text-white' : 'text-stone-400 hover:text-stone-200'}`}
            >
              LIVE
            </button>
            <button 
              onClick={() => setIsLive(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!isLive ? 'bg-stone-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}
            >
              PAUSED
            </button>
          </div>

          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 rounded-2xl font-bold text-sm transition-all"
          >
            <ArrowLeft size={18} />
            Back to Chat
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={<Cpu className="text-blue-400" />} 
            label="CPU Usage" 
            value={`${metrics.cpu.overall.toFixed(1)}%`}
            subValue={`${metrics.cpu.cores.length} Cores @ ${metrics.cpu.frequency.toFixed(0)}MHz`}
            progress={metrics.cpu.overall}
            colorClass={getStatusColor(metrics.cpu.overall)}
            progressColor={getProgressColor(metrics.cpu.overall)}
          />
          <StatCard 
            icon={<Database className="text-purple-400" />} 
            label="Memory" 
            value={`${metrics.memory.usage.toFixed(1)}%`}
            subValue={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
            progress={metrics.memory.usage}
            colorClass={getStatusColor(metrics.memory.usage)}
            progressColor={getProgressColor(metrics.memory.usage)}
          />
          <StatCard 
            icon={<HardDrive className="text-amber-400" />} 
            label="Primary Disk" 
            value={`${metrics.disk[0]?.usage.toFixed(1)}%`}
            subValue={`${formatBytes(metrics.disk[0]?.used || 0)} used on ${metrics.disk[0]?.drive || 'N/A'}`}
            progress={metrics.disk[0]?.usage || 0}
            colorClass={getStatusColor(metrics.disk[0]?.usage || 0)}
            progressColor={getProgressColor(metrics.disk[0]?.usage || 0)}
          />
          <StatCard 
            icon={<Globe className="text-emerald-400" />} 
            label="Network" 
            value={`${metrics.network.bandwidth.download.toFixed(1)} Mb/s`}
            subValue={`↑ ${metrics.network.bandwidth.upload.toFixed(1)} Mb/s • ${metrics.network.connections} Conn`}
            progress={Math.min(100, (metrics.network.bandwidth.download / 100) * 100)}
            colorClass="text-emerald-400"
            progressColor="bg-emerald-500"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CPU & Memory History */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Activity size={20} className="text-amber-500" />
              Performance History
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#57534e" fontSize={12} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #444', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="cpu" name="CPU" stroke="#f59e0b" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
                  <Area type="monotone" dataKey="memory" name="RAM" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMem)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> CPU Usage
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                <span className="w-3 h-3 rounded-full bg-purple-500" /> Memory Usage
              </div>
            </div>
          </div>

          {/* Network History */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Globe size={20} className="text-emerald-500" />
              Network Traffic
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#57534e" fontSize={12} unit="M" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #444', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="download" name="Download" stroke="#10b981" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="upload" name="Upload" stroke="#3b82f6" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                <span className="w-3 h-1 bg-emerald-500 rounded-full" /> Download
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                <span className="w-3 h-1 border-t-2 border-dashed border-blue-500" /> Upload
              </div>
            </div>
          </div>
        </div>

        {/* Lower Grid: Disk & Processes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Processes List */}
          <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Zap size={20} className="text-rose-400" />
              Resource-Intensive Processes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-500 border-b border-stone-800">
                    <th className="text-left font-bold pb-4">Process Name</th>
                    <th className="text-center font-bold pb-4">PID</th>
                    <th className="text-center font-bold pb-4">CPU</th>
                    <th className="text-center font-bold pb-4">Memory</th>
                    <th className="text-right font-bold pb-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {metrics.processes.slice(0, 12).sort((a, b) => b.cpu - a.cpu).map((p) => (
                    <tr key={p.pid} className="group hover:bg-stone-800/50 transition-colors">
                      <td className="py-4 font-bold text-stone-300">{p.name}</td>
                      <td className="py-4 text-center text-stone-500">{p.pid}</td>
                      <td className={`py-4 text-center font-black ${getStatusColor(p.cpu)}`}>{p.cpu.toFixed(1)}%</td>
                      <td className="py-4 text-center text-stone-400">{formatBytes(p.memory)}</td>
                      <td className="py-4 text-right">
                        <span className="px-3 py-1 bg-stone-800 rounded-full text-[10px] font-black tracking-widest uppercase text-stone-500 group-hover:text-stone-300 transition-colors">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Info Panel */}
          <div className="space-y-6">
            {/* Storage Info */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <HardDrive size={20} className="text-stone-400" />
                Storage Devices
              </h3>
              <div className="space-y-6">
                {metrics.disk.map((d) => (
                  <div key={d.drive} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="font-bold text-stone-300">{d.drive} <span className="text-xs text-stone-500 ml-1 font-normal">{d.filesystem}</span></div>
                      <div className={`text-sm font-black ${getStatusColor(d.usage)}`}>{d.usage.toFixed(1)}%</div>
                    </div>
                    <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getProgressColor(d.usage)} transition-all duration-1000`} 
                        style={{ width: `${d.usage}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                      <span>{formatBytes(d.used)} Used</span>
                      <span>{formatBytes(d.available)} Free</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Specs */}
            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-amber-500/5 rotate-12 transition-transform group-hover:scale-110">
                <Info size={120} />
              </div>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Info size={20} className="text-amber-500" />
                System Info
              </h3>
              <div className="space-y-4 text-sm relative z-10">
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">OS Platform</span>
                  <span className="text-stone-200 font-bold">Windows</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Processor</span>
                  <span className="text-stone-200 font-bold">{metrics.cpu.cores.length} Cores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Uptime</span>
                  <span className="text-stone-200 font-bold">{metrics.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400 font-medium">Last Sync</span>
                  <span className="text-stone-200 font-bold">{new Date(metrics.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, progress, colorClass, progressColor }: any) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl hover:border-stone-700 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className={`text-xl font-black ${colorClass}`}>
          {value}
        </div>
      </div>
      <h3 className="text-stone-400 font-bold text-xs uppercase tracking-widest mb-1">{label}</h3>
      <p className="text-stone-500 text-[10px] mb-4 font-medium">{subValue}</p>
      <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${progressColor} transition-all duration-1000 ease-out`} 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
}

