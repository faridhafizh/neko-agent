"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  fetchTerminalSessions,
  createTerminalSession,
  executeTerminalCommand,
  deleteTerminalSession,
  TerminalSession,
  TerminalCommandResult
} from "@/lib/api";

export default function TerminalPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await fetchTerminalSessions();
      setSessions(data.sessions);
      if (data.sessions.length > 0 && !activeSession) {
        setActiveSession(data.sessions[0]);
      }
    } catch (e: any) {
      console.error("Failed to load sessions:", e);
    }
  };

  const createNewSession = async () => {
    try {
      const session = await createTerminalSession(`Terminal ${sessions.length + 1}`);
      setSessions([...sessions, session]);
      setActiveSession(session);
      setOutput([]);
    } catch (e: any) {
      console.error("Failed to create session:", e);
    }
  };

  const executeCommand = async () => {
    if (!command.trim() || !activeSession) return;

    setExecuting(true);
    try {
      const result = await executeTerminalCommand(activeSession.id, command);
      
      // Add command to output
      setOutput(prev => [...prev, `$ ${command}`]);
      
      // Add result output
      if (result.output) {
        const lines = result.output.split('\n');
        setOutput(prev => [...prev, ...lines]);
      }

      // Clear command input
      setCommand("");
      
      // Refresh sessions to update working directory
      await loadSessions();
    } catch (e: any) {
      setOutput(prev => [...prev, `Error: ${e.message}`]);
    } finally {
      setExecuting(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await deleteTerminalSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(sessions.length > 1 ? sessions[0] : null);
        setOutput([]);
      }
    } catch (e: any) {
      console.error("Failed to delete session:", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-950">
      {/* Header */}
      <div className="shrink-0 bg-stone-900 border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl bg-stone-800 p-2 rounded-xl">💻</span>
          <div>
            <h1 className="text-2xl font-black text-amber-500">Terminal</h1>
            <p className="text-sm text-stone-400">Interactive PowerShell terminal</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-medium transition-colors"
        >
          ← Back to Chat
        </button>
      </div>

      {/* Session Tabs */}
      <div className="shrink-0 bg-stone-800 border-b border-stone-700 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors whitespace-nowrap ${
              activeSession?.id === session.id
                ? "bg-amber-500 text-white"
                : "bg-stone-700 text-stone-300 hover:bg-stone-600"
            }`}
          >
            {session.title}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
              className="ml-2 text-stone-400 hover:text-red-400"
            >
              ×
            </button>
          </button>
        ))}
        <button
          onClick={createNewSession}
          className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-lg text-sm transition-colors"
        >
          + New
        </button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <>
            {/* Terminal Output */}
            <div className="flex-1 bg-black p-4 overflow-y-auto font-mono text-sm">
              <div className="text-green-400 mb-2">
                PowerShell Terminal - {activeSession.workingDir}
              </div>
              {output.map((line, index) => (
                <div key={index} className={line.startsWith('$') ? 'text-amber-400' : 'text-stone-300'}>
                  {line}
                </div>
              ))}
              {executing && (
                <div className="text-amber-400 animate-pulse">Executing...</div>
              )}
            </div>

            {/* Command Input */}
            <div className="shrink-0 bg-stone-900 border-t border-stone-700 p-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-mono text-sm">
                  PS {activeSession.workingDir.split('\\').pop()}&gt;
                </span>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={executing}
                  className="flex-1 bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="Enter PowerShell command..."
                />
                <button
                  onClick={executeCommand}
                  disabled={executing || !command.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  Execute
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-500">
            <div className="text-center">
              <span className="text-6xl mb-4 block">💻</span>
              <p className="text-xl font-medium mb-2">No terminal session</p>
              <button
                onClick={createNewSession}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium transition-colors"
              >
                Create Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
