const API_BASE = "http://localhost:8080/api";

export interface ProviderConfig {
  name: string;
  type: string; // openai, anthropic, zhipu, local
  apiKey: string;
  apiUrl: string;
  models: string[];
  settings: Record<string, any>;
}

export interface Settings {
  // Legacy fields for backward compatibility
  apiKey: string;
  model: string;
  apiUrl: string;
  
  // New multi-provider fields
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
}

export interface PendingCommand {
  id: string;
  command: string;
  arguments: string[];
  description: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  hasPendingCmd: boolean;
  pendingCommand?: PendingCommand;
  activeSoul: string;
  soulEmoji: string;
  memoryCount: number;
}

export interface SystemInfo {
  os: string;
  hostname: string;
  username: string;
  currentDir: string;
  cpuUsage: number;
  ramUsed: number;
  ramTotal: number;
  ramUsage: number;
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  const res = await fetch(`${API_BASE}/system/info`);
  if (!res.ok) throw new Error("Failed to fetch system info");
  return res.json();
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  messageCount?: number;
  lastMessage?: string;
}

export interface ChatSessionFull {
  id: string;
  title: string;
  messages: { role: string; content: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface Memory {
  id: string;
  content: string;
  category: string;
  priority: number;
  createdAt: string;
  lastUsed: string;
  tags: string[];
}

export interface SoulProfile {
  name: string;
  description: string;
  systemPrompt: string;
  emoji: string;
  color: string;
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function saveSettings(settings: Settings): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

export async function sendChatMessage(message: string, sessionId?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to send chat message");
  }
  return res.json();
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onToolCall: (cmd: PendingCommand) => void;
  onDone: (meta: { sessionId: string; activeSoul: string; soulEmoji: string; memoryCount: number }) => void;
  onError: (error: string) => void;
}

export async function streamChatMessage(
  message: string,
  callbacks: StreamCallbacks,
  sessionId?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to start stream");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream reader");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const event = JSON.parse(jsonStr);
        switch (event.type) {
          case "token":
            callbacks.onToken(event.content);
            break;
          case "tool_call":
            callbacks.onToolCall({
              id: event.id,
              command: event.command,
              arguments: [],
              description: event.description,
            });
            break;
          case "done":
            callbacks.onDone({
              sessionId: event.sessionId,
              activeSoul: event.activeSoul,
              soulEmoji: event.soulEmoji,
              memoryCount: event.memoryCount,
            });
            break;
          case "error":
            callbacks.onError(event.content);
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

export async function approveCommand(id: string): Promise<{status: string, output: string, reply: string, sessionId: string}> {
  const res = await fetch(`${API_BASE}/command/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to approve command");
  }
  return res.json();
}

export async function rejectCommand(id: string): Promise<{status: string, sessionId: string}> {
  const res = await fetch(`${API_BASE}/command/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to reject command");
  }
  return res.json();
}

// Memory API functions
export async function fetchMemories(category?: string): Promise<{memories: Memory[], count: number}> {
  const url = category 
    ? `${API_BASE}/memory?category=${category}`
    : `${API_BASE}/memory`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch memories");
  return res.json();
}

export async function addMemory(content: string, category: string, priority: number, tags: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, category, priority, tags })
  });
  if (!res.ok) throw new Error("Failed to add memory");
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/memory?id=${id}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete memory");
}

export async function searchMemories(query: string): Promise<{memories: Memory[], count: number}> {
  const res = await fetch(`${API_BASE}/memory/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search memories");
  return res.json();
}

export async function fetchMemoryStats(): Promise<{total: number, byCategory: Record<string, number>}> {
  const res = await fetch(`${API_BASE}/memory/stats`);
  if (!res.ok) throw new Error("Failed to fetch memory stats");
  return res.json();
}

// Soul API functions
export async function fetchSouls(): Promise<{souls: Record<string, SoulProfile>, activeSoul: string, activeProfile: SoulProfile}> {
  const res = await fetch(`${API_BASE}/souls`);
  if (!res.ok) throw new Error("Failed to fetch souls");
  return res.json();
}

export async function setActiveSoul(soulId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/souls/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soulId })
  });
  if (!res.ok) throw new Error("Failed to set active soul");
}

export async function addCustomSoul(soul: SoulProfile & { id: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/souls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(soul)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to add custom soul");
  }
}

export async function deleteCustomSoul(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/souls?id=${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to delete custom soul");
  }
}

// Chat Session API functions
export async function fetchChatSessions(includeArchived = false): Promise<{ sessions: ChatSession[] }> {
  const res = await fetch(`${API_BASE}/chats${includeArchived ? '?archived=true' : ''}`);
  if (!res.ok) throw new Error("Failed to fetch chat sessions");
  return res.json();
}

export async function createChatSession(title?: string): Promise<ChatSession> {
  const res = await fetch(`${API_BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "New Chat" })
  });
  if (!res.ok) throw new Error("Failed to create chat session");
  return res.json();
}

export async function fetchChatSession(id: string): Promise<ChatSessionFull> {
  const res = await fetch(`${API_BASE}/chats/${id}`);
  if (!res.ok) throw new Error("Failed to fetch chat session");
  return res.json();
}

export async function updateChatSession(id: string, action: string, title?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, title })
  });
  if (!res.ok) throw new Error(`Failed to ${action} chat session`);
}

// Filesystem API functions
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  lastModified: string;
}

export async function fetchFiles(path: string = ""): Promise<{ baseDir: string, current: string, files: FileEntry[] }> {
  const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("Failed to fetch files");
  return res.json();
}

export async function readFile(path: string): Promise<{ path: string, content: string }> {
  const res = await fetch(`${API_BASE}/files/read?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("Failed to read file");
  return res.json();
}

export async function writeFile(path: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to save file");
  }
}

export async function createDirectory(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!res.ok) throw new Error("Failed to create directory");
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(path)}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete file or directory");
}

// Command Builder API interfaces
export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string;
  parameters: CommandParameter[];
  icon: string;
  tags: string[];
}

export interface CommandParameter {
  name: string;
  type: string; // text, number, boolean, select, file, directory
  description: string;
  required: boolean;
  defaultValue: string;
  options?: string[];
}

// Command Builder API functions
export async function fetchCommandTemplates(category?: string): Promise<{
  templates: CommandTemplate[];
  categories: Record<string, CommandTemplate[]>;
  total: number;
}> {
  const url = category 
    ? `${API_BASE}/command/templates?category=${encodeURIComponent(category)}`
    : `${API_BASE}/command/templates`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch command templates");
  return res.json();
}

export async function validateCommand(command: string, parameters: Record<string, string>): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const res = await fetch(`${API_BASE}/command/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, parameters })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to validate command");
  }
  
  return res.json();
}

export async function executeCommand(command: string, parameters: Record<string, string>): Promise<{
  status: string;
  pendingCommand: PendingCommand;
  finalCommand: string;
}> {
  const res = await fetch(`${API_BASE}/command/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, parameters })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to execute command");
  }
  
  return res.json();
}

// System Monitoring API interfaces
export interface SystemMetrics {
  timestamp: string;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics[];
  network: NetworkMetrics;
  processes: ProcessMetrics[];
  uptime: string;
  loadAverage: number[];
}

export interface CPUMetrics {
  overall: number;
  cores: CoreMetrics[];
  frequency: number;
  temperature: number;
}

export interface CoreMetrics {
  id: number;
  usage: number;
}

export interface MemoryMetrics {
  total: number;
  used: number;
  available: number;
  usage: number;
  swap: SwapMetrics;
}

export interface SwapMetrics {
  total: number;
  used: number;
  usage: number;
}

export interface DiskMetrics {
  drive: string;
  total: number;
  used: number;
  available: number;
  usage: number;
  filesystem: string;
  mountPoint: string;
  readOps: number;
  writeOps: number;
}

export interface NetworkMetrics {
  interfaces: NetworkInterface[];
  bandwidth: BandwidthMetrics;
  connections: number;
}

export interface NetworkInterface {
  name: string;
  status: string;
  sent: number;
  received: number;
  packetsIn: number;
  packetsOut: number;
}

export interface BandwidthMetrics {
  download: number;
  upload: number;
}

export interface ProcessMetrics {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  startTime: string;
  status: string;
}

// System Monitoring API functions
export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${API_BASE}/system/metrics`);
  if (!res.ok) throw new Error("Failed to fetch system metrics");
  return res.json();
}

export async function fetchSystemMetricsHistory(limit?: number, duration?: string): Promise<{
  history: SystemMetrics[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (duration) params.append('duration', duration);
  
  const res = await fetch(`${API_BASE}/system/history?${params}`);
  if (!res.ok) throw new Error("Failed to fetch metrics history");
  return res.json();
}

export function subscribeSystemMetrics(onMetrics: (metrics: SystemMetrics) => void): () => void {
  const wsUrl = API_BASE.replace("http://", "ws://") + "/system/live";
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const metrics = JSON.parse(event.data);
      onMetrics(metrics);
    } catch (e) {
      console.error("Failed to parse WebSocket metrics:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return () => {
    ws.close();
  };
}


// Terminal API interfaces
export interface TerminalSession {
  id: string;
  title: string;
  createdAt: string;
  lastActive: string;
  workingDir: string;
  command: string;
  history: string[];
  isActive: boolean;
}

export interface TerminalCommandResult {
  output: string;
  exitCode: number;
  isError: boolean;
  timestamp: string;
}

// Terminal API functions
export async function fetchTerminalSessions(): Promise<{
  sessions: TerminalSession[];
  total: number;
}> {
  const res = await fetch(`${API_BASE}/terminal/sessions`);
  if (!res.ok) throw new Error("Failed to fetch terminal sessions");
  return res.json();
}

export async function createTerminalSession(title: string): Promise<TerminalSession> {
  const res = await fetch(`${API_BASE}/terminal/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to create terminal session");
  }
  
  return res.json();
}

export async function fetchTerminalSession(sessionId: string): Promise<TerminalSession> {
  const res = await fetch(`${API_BASE}/terminal/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch terminal session");
  return res.json();
}

export async function executeTerminalCommand(sessionId: string, command: string): Promise<TerminalCommandResult> {
  const res = await fetch(`${API_BASE}/terminal/sessions/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to execute terminal command");
  }
  
  return res.json();
}

export async function deleteTerminalSession(sessionId: string): Promise<{status: string}> {
  const res = await fetch(`${API_BASE}/terminal/sessions/${sessionId}`, {
    method: "DELETE"
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to delete terminal session");
  }
  
  return res.json();
}

// File upload API
export async function uploadFiles(files: FileList, targetDir: string = ""): Promise<{status: string, files: any[], count: number}> {
  const formData = new FormData();
  
  // Add all files to form data
  for (let i = 0; i < files.length; i++) {
    formData.append(`files`, files[i]);
  }
  
  // Add target directory
  formData.append('targetDir', targetDir);
  
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    body: formData
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to upload files");
  }
  
  return res.json();
}

// File move/copy API
export async function moveFile(source: string, destination: string, copy: boolean = false): Promise<{status: string, action: string, source: string, dest: string}> {
  const res = await fetch(`${API_BASE}/files/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination, copy })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to move/copy file");
  }
  
  return res.json();
}

// Batch operations API
export async function batchFileOperation(operation: string, paths: string[], target?: string): Promise<{results: any[], total: number, success: number, errors: number, errorMessages?: string[]}> {
  const res = await fetch(`${API_BASE}/files/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, paths, target })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to perform batch operation");
  }
  
  return res.json();
}
