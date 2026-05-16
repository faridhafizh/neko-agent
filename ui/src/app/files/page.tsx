"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { fetchFiles, readFile, writeFile, createDirectory, deleteFile, uploadFiles, moveFile, batchFileOperation, FileEntry } from "@/lib/api";

export default function FilesPage() {
  const [currentDir, setCurrentDir] = useState<string>("");
  const [baseDir, setBaseDir] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Editor state
  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  
  // Multi-select state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [showBatchActions, setShowBatchActions] = useState(false);
  
  // Upload progress
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadDirectory = useCallback(async (path: string = "") => {
    setLoading(true);
    try {
      const data = await fetchFiles(path);
      setFiles(data.files.sort((a, b) => {
        // Directories first
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentDir(data.current);
      setBaseDir(data.baseDir);
    } catch (e: any) {
      showNotification(e.message || "Failed to load directory", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const showNotification = (msg: string, type: 'success'|'error'|'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadFiles(droppedFiles, currentDir);
      showNotification(`Successfully uploaded ${result.count} files`, "success");
      await loadDirectory(currentDir);
    } catch (e: any) {
      showNotification(e.message || "Failed to upload files", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Multi-select handlers
  const handleFileSelect = (file: FileEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection with Ctrl/Cmd
      const newSelected = new Set(selectedFiles);
      if (newSelected.has(file.path)) {
        newSelected.delete(file.path);
      } else {
        newSelected.add(file.path);
      }
      setSelectedFiles(newSelected);
    } else if (e.shiftKey && lastSelected) {
      // Range selection with Shift
      const lastIdx = files.findIndex(f => f.path === lastSelected);
      const currentIdx = files.findIndex(f => f.path === file.path);
      
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const newSelected = new Set(selectedFiles);
        
        for (let i = start; i <= end; i++) {
          newSelected.add(files[i].path);
        }
        setSelectedFiles(newSelected);
      }
    } else {
      // Single selection
      setSelectedFiles(new Set([file.path]));
      setLastSelected(file.path);
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)));
    }
  };

  // Batch operations
  const handleBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`Delete ${selectedFiles.size} selected items? This cannot be undone.`)) return;
    
    try {
      const result = await batchFileOperation("delete", Array.from(selectedFiles));
      if (result.errors > 0) {
        showNotification(`Deleted ${result.success} items, ${result.errors} failed`, "error");
      } else {
        showNotification(`Successfully deleted ${result.success} items`, "success");
      }
      setSelectedFiles(new Set());
      await loadDirectory(currentDir);
    } catch (e: any) {
      showNotification(e.message || "Failed to delete items", "error");
    }
  };

  const handleBatchMove = async (targetDir: string) => {
    if (selectedFiles.size === 0) return;
    
    try {
      const result = await batchFileOperation("move", Array.from(selectedFiles), targetDir);
      if (result.errors > 0) {
        showNotification(`Moved ${result.success} items, ${result.errors} failed`, "error");
      } else {
        showNotification(`Successfully moved ${result.success} items`, "success");
      }
      setSelectedFiles(new Set());
      await loadDirectory(currentDir);
    } catch (e: any) {
      showNotification(e.message || "Failed to move items", "error");
    }
  };

  const handleFileClick = async (file: FileEntry) => {
    if (file.isDir) {
      loadDirectory(file.path);
    } else {
      if (isDirty) {
        const confirm = window.confirm("You have unsaved changes. Discard them?");
        if (!confirm) return;
      }
      
      try {
        setLoading(true);
        const data = await readFile(file.path);
        setActiveFile(file);
        setFileContent(data.content);
        setIsDirty(false);
      } catch (e: any) {
        showNotification(e.message || "Could not read file", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoUp = () => {
    if (!currentDir || currentDir === baseDir || currentDir === "/") return;
    
    // Simple path manipulation to go up one level
    const parts = currentDir.split(/[\\/]/);
    parts.pop();
    const parent = parts.join("/");
    loadDirectory(parent || "/");
  };

  const handleCreateFolder = async () => {
    const name = window.prompt("New folder name:");
    if (!name?.trim()) return;
    
    // Handle path separator based on OS via basic logic (assume / for web but backend handles it)
    const newPath = currentDir ? `${currentDir}/${name}` : name;
    try {
      await createDirectory(newPath);
      showNotification(`Folder ${name} created`, "success");
      loadDirectory(currentDir);
    } catch (e: any) {
      showNotification(e.message, "error");
    }
  };

  const handleCreateFile = async () => {
    const name = window.prompt("New file name:");
    if (!name?.trim()) return;
    
    const newPath = currentDir ? `${currentDir}/${name}` : name;
    try {
      await writeFile(newPath, "");
      showNotification(`File ${name} created`, "success");
      await loadDirectory(currentDir);
      
      // Auto-open new file
      handleFileClick({
        name,
        path: newPath,
        isDir: false,
        size: 0,
        lastModified: new Date().toISOString()
      });
    } catch (e: any) {
      showNotification(e.message, "error");
    }
  };

  const handleDelete = async (e: React.MouseEvent, file: FileEntry) => {
    e.stopPropagation();
    const type = file.isDir ? "Folder" : "File";
    if (!window.confirm(`Delete ${type} "${file.name}"? This cannot be undone.`)) return;

    try {
      await deleteFile(file.path);
      showNotification(`${type} deleted`, "success");
      if (activeFile?.path === file.path) {
        setActiveFile(null);
        setFileContent("");
        setIsDirty(false);
      }
      loadDirectory(currentDir);
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    setFileContent(value || "");
    setIsDirty(true);
  };

  const saveCurrentFile = async () => {
    if (!activeFile || !isDirty) return;
    
    setSaving(true);
    try {
      await writeFile(activeFile.path, fileContent);
      setIsDirty(false);
      showNotification("Saved successfully", "success");
    } catch (e: any) {
      showNotification(e.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  // Setup Ctrl+S shortcut on the wrapper
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  };

  // Determine language for Monaco based on extension
  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'json': return 'json';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'go': return 'go';
      case 'md': return 'markdown';
      case 'py': return 'python';
      case 'xml': return 'xml';
      case 'sql': return 'sql';
      case 'sh': return 'shell';
      default: return 'plaintext';
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-950 overflow-hidden">
      {/* Top Banner */}
      <div className="shrink-0 bg-stone-900 border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl bg-stone-800 p-2 rounded-xl">📂</span>
          <div>
            <h1 className="text-2xl font-black text-amber-500">File Explorer</h1>
            <p className="text-sm text-stone-400">View and edit files in Neko's workspace</p>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-slide-in flex items-center gap-2 ${
          notification.type === 'error' ? 'bg-red-900/90 text-red-200 border border-red-700' :
          notification.type === 'success' ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700' :
          'bg-stone-800 text-stone-200 border border-stone-700'
        }`}>
          <span>{notification.type === 'error' ? '❌' : notification.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span className="text-sm font-medium">{notification.msg}</span>
        </div>
      )}

      {/* Main Content Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar - File Tree */}
        <div className="w-80 flex flex-col bg-stone-900/50 border-r border-stone-800 shrink-0">
          
          {/* File Toolbar */}
          <div className="p-3 border-b border-stone-800 flex items-center justify-between bg-stone-900/80">
            <div className="flex items-center gap-1">
              <button 
                onClick={handleGoUp}
                disabled={currentDir === baseDir || !currentDir}
                className="p-1.5 text-stone-400 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-stone-400 transition-colors rounded-lg hover:bg-stone-800"
                title="Go up one folder"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button 
                onClick={() => loadDirectory(currentDir)}
                className="p-1.5 text-stone-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-stone-800"
                title="Refresh"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <button onClick={handleCreateFile} className="p-1.5 text-stone-400 hover:text-emerald-400 transition-colors rounded-lg hover:bg-stone-800" title="New File">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>
              </button>
              <button onClick={handleCreateFolder} className="p-1.5 text-stone-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-stone-800" title="New Folder">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
              </button>
            </div>
          </div>

          {/* Current Path Breadcrumb */}
          <div className="px-4 py-2 bg-stone-950 border-b border-stone-800 text-[10px] font-mono text-stone-500 truncate" title={currentDir}>
            {currentDir || baseDir}
          </div>

          {/* File List */}
          <div 
            className={`flex-1 overflow-y-auto p-2 relative ${isDragging ? "bg-amber-500/10" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag and Drop Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-amber-500/20 border-2 border-amber-500 border-dashed rounded-lg flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-amber-400 font-semibold">Drop files here to upload</div>
                  <div className="text-amber-300 text-sm mt-1">Files will be uploaded to current directory</div>
                </div>
              </div>
            )}

            {/* Batch Actions Bar */}
            {selectedFiles.size > 0 && (
              <div className="sticky top-0 bg-stone-800 border-b border-stone-600 p-2 mb-2 rounded-lg z-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === files.length}
                      onChange={handleSelectAll}
                      className="rounded border-stone-600 bg-stone-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-stone-300">
                      {selectedFiles.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleBatchDelete}
                      className="p-1.5 text-stone-400 hover:text-red-400 transition-colors rounded hover:bg-stone-700"
                      title="Delete selected"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                    <button
                      onClick={() => {
                        const target = prompt("Move to directory:");
                        if (target) handleBatchMove(target);
                      }}
                      className="p-1.5 text-stone-400 hover:text-amber-400 transition-colors rounded hover:bg-stone-700"
                      title="Move selected"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && files.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="typing-indicator"><span /><span /><span /></div>
              </div>
            ) : files.length === 0 ? (
              <p className="text-stone-500 text-sm text-center py-6 italic">Folder is empty</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {files.map((file) => (
                  <div 
                    key={file.path}
                    onClick={() => handleFileClick(file)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
                      activeFile?.path === file.path 
                        ? "bg-amber-500/20 text-amber-400" 
                        : selectedFiles.has(file.path)
                        ? "bg-stone-700 text-stone-200"
                        : "hover:bg-stone-800 text-stone-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.path)}
                      onChange={(e) => handleFileSelect(file, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-stone-600 bg-stone-700 text-amber-500 focus:ring-amber-500 shrink-0"
                    />
                    <span className="text-lg opacity-80 shrink-0">
                      {file.isDir ? "📁" : "📄"}
                    </span>
                    <span className={`text-sm truncate flex-1 ${file.isDir ? "font-semibold" : ""}`}>
                      {file.name}
                    </span>
                    <button 
                      onClick={(e) => handleDelete(e, file)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-600 hover:text-red-400 transition-all rounded hover:bg-stone-700 shrink-0"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="sticky bottom-0 bg-stone-800 border-t border-stone-600 p-3 rounded-lg mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-stone-400 mb-1">Uploading files...</div>
                    <div className="w-full bg-stone-700 rounded-full h-2">
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]" onKeyDown={handleEditorKeyDown}>
          {activeFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-[#cccccc]">
                    {activeFile.name}
                    {isDirty && <span className="ml-2 text-amber-400 font-bold">*</span>}
                  </span>
                  {saving && <span className="text-[10px] text-stone-400 bg-stone-800 px-2 rounded animate-pulse">Saving...</span>}
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-stone-500 hidden md:inline">Ctrl+S to save</span>
                  <button 
                    onClick={saveCurrentFile}
                    disabled={!isDirty || saving}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:bg-[#3c3c3c] text-white text-xs font-semibold rounded transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save
                  </button>
                </div>
              </div>
              <div className="flex-1 pt-2">
                <Editor
                  height="100%"
                  defaultLanguage={getLanguage(activeFile.name)}
                  language={getLanguage(activeFile.name)}
                  theme="vs-dark"
                  value={fileContent}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: true, side: 'right' },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    padding: { top: 16 },
                    renderWhitespace: 'all',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                  }}
                  loading={<div className="flex h-full items-center justify-center text-stone-500">Loading editor component...</div>}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#cccccc] opacity-40 selection-none">
              <span className="text-6xl mb-4">📝</span>
              <p className="text-xl font-medium">Select a file to start editing</p>
              <p className="font-mono text-sm mt-2">Neko Editor</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
