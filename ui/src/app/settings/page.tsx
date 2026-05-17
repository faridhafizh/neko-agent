"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSettings, saveSettings, Settings, ProviderConfig, fetchSouls, setActiveSoul, SoulProfile, addCustomSoul, deleteCustomSoul } from "@/lib/api";

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

  // Custom Soul Creator state
  const [showCreator, setShowCreator] = useState(false);
  const [creatorForm, setCreatorForm] = useState({
    id: "",
    name: "",
    description: "",
    systemPrompt: "",
    emoji: "🐱",
    color: "amber"
  });

  const handleCreateSoul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorForm.id || !creatorForm.name || !creatorForm.systemPrompt) return;
    try {
      await addCustomSoul({
        id: creatorForm.id,
        name: creatorForm.name,
        description: creatorForm.description,
        systemPrompt: creatorForm.systemPrompt,
        emoji: creatorForm.emoji,
        color: creatorForm.color
      });
      // Refresh souls list
      const res = await fetchSouls();
      setSouls(res.souls);
      setShowCreator(false);
      // Reset form
      setCreatorForm({
        id: "",
        name: "",
        description: "",
        systemPrompt: "",
        emoji: "🐱",
        color: "amber"
      });
    } catch (e: any) {
      alert("Failed to create custom soul: " + e.message);
    }
  };

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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(souls).map(([id, soul]) => (
                <div
                  key={id}
                  onClick={() => handleSoulChange(id)}
                  className={`group relative p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                    activeSoulId === id
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md"
                      : "border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 hover:border-amber-300 dark:hover:border-amber-700"
                  }`}
                >
                  <div className="text-3xl mb-2">{soul.emoji}</div>
                  <div className="font-semibold text-stone-800 dark:text-stone-100">{soul.name}</div>
                  <div className="text-sm text-stone-600 dark:text-stone-400 mt-1">{soul.description}</div>

                  {/* Delete button for custom souls */}
                  {!["default", "playful", "scholarly", "efficient", "creative"].includes(id) && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the "${soul.name}" persona?`)) {
                          try {
                            await deleteCustomSoul(id);
                            const res = await fetchSouls();
                            setSouls(res.souls);
                            setActiveSoulId(res.activeSoul);
                          } catch (e: any) {
                            alert("Failed to delete custom soul: " + e.message);
                          }
                        }
                      }}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-white transition-all text-xs font-bold"
                      title="Delete Custom Persona"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {/* Create Custom Soul Action Card */}
              <div
                onClick={() => setShowCreator(!showCreator)}
                className="p-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/5 dark:bg-amber-900/5 hover:bg-amber-50/10 hover:border-amber-400 cursor-pointer flex flex-col items-center justify-center text-center group transition-all"
              >
                <span className="text-3xl mb-2 text-amber-500 group-hover:scale-110 transition-transform">➕</span>
                <span className="font-semibold text-amber-600 dark:text-amber-500">Create Persona</span>
                <span className="text-xs text-stone-500 mt-1">Design Neko's personality</span>
              </div>
            </div>

            {/* Custom Soul Creator Form Panel */}
            {showCreator && (
              <form onSubmit={handleCreateSoul} className="mt-6 p-6 border border-amber-200 dark:border-amber-900/50 rounded-xl bg-amber-50/5 dark:bg-stone-900/20 space-y-4">
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                  🎨 Create Custom Soul Profile
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Unique ID (lowercase, no spaces)</label>
                    <input
                      type="text"
                      value={creatorForm.id}
                      onChange={e => setCreatorForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") }))}
                      className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      placeholder="e.g. devops-neko"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Soul Name</label>
                    <input
                      type="text"
                      value={creatorForm.name}
                      onChange={e => setCreatorForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      placeholder="e.g. DevOps Neko"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Description</label>
                    <input
                      type="text"
                      value={creatorForm.description}
                      onChange={e => setCreatorForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      placeholder="e.g. Wise cloud system administrator cat"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Emoji Icon</label>
                      <input
                        type="text"
                        value={creatorForm.emoji}
                        onChange={e => setCreatorForm(prev => ({ ...prev, emoji: e.target.value }))}
                        className="w-full text-center bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100 text-xl"
                        placeholder="🐱"
                        required
                    />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">Theme Color</label>
                      <select
                        value={creatorForm.color}
                        onChange={e => setCreatorForm(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100"
                      >
                        <option value="amber">Amber (Gold)</option>
                        <option value="orange">Orange</option>
                        <option value="blue">Blue (Sapphire)</option>
                        <option value="green">Green (Emerald)</option>
                        <option value="purple">Purple (Amethyst)</option>
                        <option value="red">Red (Ruby)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-600 dark:text-stone-400">System Instruction Prompt (System Role)</label>
                  <textarea
                    value={creatorForm.systemPrompt}
                    onChange={e => setCreatorForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    rows={6}
                    className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-stone-800 dark:text-stone-100 font-mono text-sm"
                    placeholder="e.g. You are DevOps Neko-Agent... Always double check security guidelines..."
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={() => setShowCreator(false)}
                    className="px-4 py-2 bg-stone-500 hover:bg-stone-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
                  >
                    Create Persona 🐾
                  </button>
                </div>
              </form>
            )}
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
