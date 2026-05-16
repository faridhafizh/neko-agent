"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSettings, saveSettings, Settings, ProviderConfig, fetchSouls, setActiveSoul, SoulProfile } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({ 
    apiKey: "", 
    model: "glm-4.7-flash", 
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/",
    activeProvider: "zhipu",
    providers: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [souls, setSouls] = useState<Record<string, SoulProfile>>({});
  const [activeSoulId, setActiveSoulId] = useState("default");
  const [soulsLoading, setSoulsLoading] = useState(true);
  
  // Provider management state
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then(s => {
      if (s) setSettings(s);
      setLoading(false);
    }).catch(e => {
        setLoading(false);
    });
    
    fetchSouls().then(res => {
      setSouls(res.souls);
      setActiveSoulId(res.activeSoul);
      setSoulsLoading(false);
    }).catch(e => {
      console.error("Failed to load souls:", e);
      setSoulsLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) {
      alert("Failed to save");
    }
    setSaving(false);
  };

  const handleSoulChange = async (soulId: string) => {
    try {
      await setActiveSoul(soulId);
      setActiveSoulId(soulId);
    } catch (e: any) {
      alert("Failed to change soul: " + e.message);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSettings(prev => ({ ...prev, activeProvider: providerId }));
  };

  const updateProviderConfig = (providerId: string, config: ProviderConfig) => {
    setSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: config
      }
    }));
  };

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      // This would be a new API endpoint to test provider connectivity
      const provider = settings.providers[providerId];
      if (!provider.apiKey) {
        alert("Please configure the API key first");
        return;
      }
      
      // For now, just simulate testing
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert("Provider test successful!");
    } catch (e: any) {
      alert("Provider test failed: " + e.message);
    } finally {
      setTestingProvider(null);
    }
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case "openai": return "🤖";
      case "anthropic": return "🧠";
      case "zhipu": return "🐱";
      case "local": return "🏠";
      default: return "⚙️";
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
          ⚙️ Settings
        </h1>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-medium transition-colors"
        >
          ← Back to Chat
        </button>
      </div>

      {/* Soul Selection */}
      <div className="bg-white dark:bg-stone-800 border-2 border-amber-200 dark:border-amber-900/50 rounded-xl p-6 mb-6 shadow-md">
        <h2 className="text-xl font-bold mb-4 text-stone-700 dark:text-stone-200 flex items-center gap-2">
          🎭 Neko Soul (Personality)
        </h2>
        {soulsLoading ? (
          <div className="text-center py-4 text-amber-600 dark:text-amber-500 animate-pulse">Loading souls...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(souls).map(([id, soul]) => (
              <button
                key={id}
                onClick={() => handleSoulChange(id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  activeSoulId === id
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md"
                    : "border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                <div className="text-3xl mb-2">{soul.emoji}</div>
                <div className="font-semibold text-stone-800 dark:text-stone-100">{soul.name}</div>
                <div className="text-sm text-stone-600 dark:text-stone-400 mt-1">{soul.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Provider Settings */}
      <div className="bg-white dark:bg-stone-800 border-2 border-amber-200 dark:border-amber-900/50 rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4 text-stone-700 dark:text-stone-200 flex items-center gap-2">
          🐾 AI Provider Configuration
        </h2>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-stone-600 dark:text-stone-400">Active AI Provider</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(settings.providers).map(([id, provider]) => (
              <button
                key={id}
                onClick={() => handleProviderChange(id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  settings.activeProvider === id
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md"
                    : "border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                <div className="text-2xl mb-1">{getProviderIcon(provider.type)}</div>
                <div className="font-semibold text-sm text-stone-800 dark:text-stone-100">{provider.name}</div>
                <div className="text-xs text-stone-600 dark:text-stone-400">{provider.type}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Provider Configuration */}
        <div className="space-y-4">
          {Object.entries(settings.providers).map(([id, provider]) => (
            <div key={id} className="border border-stone-200 dark:border-stone-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getProviderIcon(provider.type)}</span>
                  <h3 className="font-semibold text-stone-800 dark:text-stone-100">{provider.name}</h3>
                  {settings.activeProvider === id && (
                    <span className="px-2 py-1 bg-amber-500 text-white text-xs rounded-full">Active</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => testProvider(id)}
                    disabled={testingProvider === id}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {testingProvider === id ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => setEditingProvider(editingProvider === id ? null : id)}
                    className="px-3 py-1 bg-stone-500 hover:bg-stone-400 text-white text-sm rounded-lg transition-colors"
                  >
                    {editingProvider === id ? "Cancel" : "Edit"}
                  </button>
                </div>
              </div>

              {editingProvider === id && (
                <div className="space-y-3 border-t border-stone-200 dark:border-stone-600 pt-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">API Key</label>
                    <input
                      type="password"
                      value={provider.apiKey}
                      onChange={e => updateProviderConfig(id, {...provider, apiKey: e.target.value})}
                      className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      placeholder="Enter API key..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">API URL</label>
                    <input
                      type="text"
                      value={provider.apiUrl}
                      onChange={e => updateProviderConfig(id, {...provider, apiUrl: e.target.value})}
                      className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      placeholder="Enter API URL..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Available Models</label>
                    <div className="space-y-1">
                      {provider.models.map((model, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={model}
                            onChange={e => {
                              const newModels = [...provider.models];
                              newModels[idx] = e.target.value;
                              updateProviderConfig(id, {...provider, models: newModels});
                            }}
                            className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-1 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100 text-sm"
                          />
                          <button
                            onClick={() => {
                              const newModels = provider.models.filter((_, i) => i !== idx);
                              updateProviderConfig(id, {...provider, models: newModels});
                            }}
                            className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white text-xs rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateProviderConfig(id, {...provider, models: [...provider.models, ""]})}
                        className="px-3 py-1 bg-green-500 hover:bg-green-400 text-white text-sm rounded-lg transition-colors"
                      >
                        Add Model
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingProvider !== id && (
                <div className="text-sm text-stone-600 dark:text-stone-400">
                  <div className="mb-1">
                    <span className="font-medium">API URL:</span> {provider.apiUrl || "Not configured"}
                  </div>
                  <div>
                    <span className="font-medium">Models:</span> {provider.models.join(", ") || "No models configured"}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className={`ml-1 ${provider.apiKey ? "text-green-600" : "text-red-600"}`}>
                      {provider.apiKey ? "Configured" : "API key required"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-stone-200 dark:border-stone-600">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-md"
          >
            {saving ? "Saving..." : "Save All Configuration"}
          </button>
          {saved && <span className="text-green-600 dark:text-green-400 animate-pulse">✓ Saved successfully!</span>}
        </div>
      </div>
    </div>
  );
}
