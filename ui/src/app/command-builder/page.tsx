"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCommandTemplates,
  validateCommand,
  executeCommand,
  CommandTemplate,
  CommandParameter,
  PendingCommand
} from "@/lib/api";

export default function CommandBuilderPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<CommandTemplate[]>([]);
  const [categories, setCategories] = useState<Record<string, CommandTemplate[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [builtCommand, setBuiltCommand] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      // Initialize parameters with default values
      const defaultParams: Record<string, string> = {};
      selectedTemplate.parameters.forEach(param => {
        defaultParams[param.name] = param.defaultValue || "";
      });
      setParameters(defaultParams);
      updateBuiltCommand(selectedTemplate.command, defaultParams);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchCommandTemplates();
      setTemplates(data.templates);
      setCategories(data.categories);
    } catch (e: any) {
      showNotification(e.message || "Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string, type: 'success'|'error'|'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateBuiltCommand = (template: string, params: Record<string, string>) => {
    let command = template;
    Object.entries(params).forEach(([key, value]) => {
      command = command.replace(new RegExp(`{{${key}}}`, 'g'), value || `{{${key}}}`);
    });
    setBuiltCommand(command);
  };

  const handleParameterChange = (paramName: string, value: string) => {
    const newParams = { ...parameters, [paramName]: value };
    setParameters(newParams);
    if (selectedTemplate) {
      updateBuiltCommand(selectedTemplate.command, newParams);
    }
  };

  const validateCurrentCommand = async () => {
    if (!selectedTemplate) return;
    
    try {
      const result = await validateCommand(selectedTemplate.command, parameters);
      setValidationErrors(result.errors);
      return result.valid;
    } catch (e: any) {
      setValidationErrors([e.message || "Validation failed"]);
      return false;
    }
  };

  const handleExecute = async () => {
    if (!selectedTemplate) return;
    
    // Validate first
    const isValid = await validateCurrentCommand();
    if (!isValid) {
      showNotification("Please fix validation errors before executing", "error");
      return;
    }

    setExecuting(true);
    try {
      const result = await executeCommand(selectedTemplate.command, parameters);
      showNotification("Command sent for approval", "success");
      
      // Navigate back to main chat to see the approval
      router.push("/");
    } catch (e: any) {
      showNotification(e.message || "Failed to execute command", "error");
    } finally {
      setExecuting(false);
    }
  };

  const renderParameterInput = (param: CommandParameter) => {
    const value = parameters[param.name] || "";

    switch (param.type) {
      case "text":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            placeholder={param.description}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            placeholder={param.description}
          />
        );

      case "boolean":
        return (
          <select
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
          >
            <option value="">Select {param.description}...</option>
            {param.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case "file":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            placeholder="Enter file path..."
          />
        );

      case "directory":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            placeholder="Enter directory path..."
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
            placeholder={param.description}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400">
        <div className="typing-indicator"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-950">
      {/* Header */}
      <div className="shrink-0 bg-stone-900 border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl bg-stone-800 p-2 rounded-xl">🔧</span>
          <div>
            <h1 className="text-2xl font-black text-amber-500">Command Builder</h1>
            <p className="text-sm text-stone-400">Build PowerShell commands visually</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-medium transition-colors"
        >
          ← Back to Chat
        </button>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Template Selection */}
        <div className="w-80 flex flex-col bg-stone-900/50 border-r border-stone-800 shrink-0">
          {/* Category Filter */}
          <div className="p-3 border-b border-stone-800">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Categories</option>
              {Object.keys(categories).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-2">
              {templates
                .filter(template => !selectedCategory || template.category === selectedCategory)
                .map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                      : "bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{template.icon}</span>
                    <span className="font-semibold text-sm">{template.name}</span>
                  </div>
                  <p className="text-xs text-stone-400">{template.description}</p>
                  <div className="flex gap-1 mt-2">
                    {template.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-stone-700 text-xs rounded text-stone-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Parameter Builder */}
        <div className="flex-1 flex flex-col">
          {selectedTemplate ? (
            <>
              {/* Template Header */}
              <div className="p-4 border-b border-stone-800 bg-stone-900/50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-100">{selectedTemplate.name}</h2>
                    <p className="text-sm text-stone-400">{selectedTemplate.description}</p>
                  </div>
                </div>
                <div className="text-xs text-stone-500">
                  Category: {selectedTemplate.category} • {selectedTemplate.parameters.length} parameters
                </div>
              </div>

              {/* Parameters */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {selectedTemplate.parameters.map(param => (
                    <div key={param.name} className="bg-stone-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-stone-200">
                          {param.name}
                          {param.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <span className="text-xs text-stone-400 bg-stone-700 px-2 py-1 rounded">
                          {param.type}
                        </span>
                      </div>
                      {param.description && (
                        <p className="text-xs text-stone-400 mb-2">{param.description}</p>
                      )}
                      {renderParameterInput(param)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Command Preview */}
              <div className="border-t border-stone-800 bg-stone-900/50 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-stone-300 mb-2">Generated Command</h3>
                  <div className="bg-stone-950 border border-stone-700 rounded-lg p-3 font-mono text-sm text-stone-100">
                    {builtCommand || "Select parameters to generate command..."}
                  </div>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="mb-3 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-red-400 mb-1">Validation Errors:</h4>
                    <ul className="text-xs text-red-300 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={validateCurrentCommand}
                    className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg font-medium transition-colors"
                  >
                    Validate
                  </button>
                  <button
                    onClick={handleExecute}
                    disabled={executing || validationErrors.length > 0}
                    className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                  >
                    {executing ? "Executing..." : "Execute Command"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-500">
              <div className="text-center">
                <span className="text-6xl mb-4 block">🔧</span>
                <p className="text-xl font-medium mb-2">Select a template to start building</p>
                <p className="text-sm">Choose from {templates.length} available command templates</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
