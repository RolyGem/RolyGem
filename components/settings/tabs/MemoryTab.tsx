import React, { useState, useRef, useEffect } from 'react';
import type { Settings, IdentityProfile, IdentityFact } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { CheckboxInput, SliderInput, NumberInput, getStatusIndicator, SegmentedControl } from '../common/SettingsInputComponents';
import { checkKoboldEmbeddingConnection } from '../../../services/koboldcppService';
import { testGeminiEmbeddingConnection, clearEmbeddingCache, testOpenAIEmbeddingConnection } from '../../../services/ai/embeddingService';

interface MemoryTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  hostname: string;
  identityProfiles: IdentityProfile[];
  onSaveIdentityProfile: (profile: IdentityProfile) => void;
  onDeleteIdentityProfile: (id: string) => void;
  hasMoreIdentityProfiles: boolean;
  onLoadMoreIdentityProfiles: () => void;
}

const EMPTY_PROFILE: Omit<IdentityProfile, 'id' | 'createdAt'> = { name: '', content: [] };

const MemoryTab: React.FC<MemoryTabProps> = ({
  settings,
  onLiveUpdate,
  hostname,
  identityProfiles,
  onSaveIdentityProfile,
  onDeleteIdentityProfile,
  hasMoreIdentityProfiles,
  onLoadMoreIdentityProfiles,
}) => {
  const [ragConnectionStatus, setRagConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(settings.rag.isConnected ? 'success' : 'idle');
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [openaiTestStatus, setOpenaiTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const profileLoaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreIdentityProfiles) {
          onLoadMoreIdentityProfiles();
        }
      },
      { threshold: 1.0 }
    );
    const currentLoader = profileLoaderRef.current;
    if (currentLoader) observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMoreIdentityProfiles, onLoadMoreIdentityProfiles]);
  
  const handleRagInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string, value: string } }) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const isCheckbox = type === 'checkbox';
    const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
    
    const newRagSettings = {
        ...settings.rag,
        [name]: isCheckbox ? isChecked : (type === 'number' ? parseInt(value, 10) : value),
    };
    const newSettings = { ...settings, rag: newRagSettings };
    onLiveUpdate(newSettings);
    
    if (name === 'koboldcppUrl') {
        onLiveUpdate({ ...settings, rag: { ...newRagSettings, isConnected: false, embeddingModelName: '' } });
    }
  };
  
  const handleConnectRag = async () => {
    setRagConnectionStatus('loading');
    const { isConnected, modelName } = await checkKoboldEmbeddingConnection(settings.rag.koboldcppUrl);
    onLiveUpdate({
        ...settings,
        rag: { ...settings.rag, isConnected, embeddingModelName: modelName }
    });
    setRagConnectionStatus(isConnected ? 'success' : 'error');
  };

  const handleTestGeminiConnection = async () => {
    setGeminiTestStatus('loading');
    try {
        await testGeminiEmbeddingConnection(settings);
        setGeminiTestStatus('success');
    } catch(e: any) {
        setGeminiTestStatus('error');
        
        // Provide helpful error message based on error type
        const isQuotaError = e.message?.includes('quota') || e.message?.includes('429');
        const errorMessage = isQuotaError 
            ? `⚠️ Gemini API Quota Exceeded\n\nYou've reached the free tier limit for embeddings.\n\nSolutions:\n1. Switch to KoboldCpp (local, unlimited)\n2. Wait for quota reset (daily limit)\n3. Upgrade to paid Gemini tier\n\nCheck console for details.`
            : `Connection Test Failed:\n\n${e.message}\n\nPlease check your API keys and browser console for more details.`;
        
        alert(errorMessage);
    }
  };

  const handleTestOpenAIConnection = async (modelType: 'small' | 'large') => {
    setOpenaiTestStatus('loading');
    try {
        await testOpenAIEmbeddingConnection(settings, modelType);
        setOpenaiTestStatus('success');
        alert(`✓ OpenAI ${modelType === 'small' ? 'text-embedding-3-small' : 'text-embedding-3-large'} connection successful!`);
    } catch(e: any) {
        setOpenaiTestStatus('error');
        alert(`Connection Test Failed:\n\n${e.message}\n\nPlease check your OpenRouter API key and browser console for more details.`);
    }
  };

  const handleClearCache = () => {
    if (window.confirm('Clear embedding cache? This will remove all cached embeddings and next requests will need to fetch fresh data from the API.')) {
        clearEmbeddingCache();
        alert('✓ Embedding cache cleared successfully!');
    }
  };
  
  const handleNewProfile = () => {
    setEditingProfileId(null);
    setProfileForm(EMPTY_PROFILE);
  };

  const handleEditProfile = (profile: IdentityProfile) => {
    setEditingProfileId(profile.id);
    setProfileForm({ name: profile.name, content: profile.content || [] });
  };
  
  const handleDeleteProfile = (id: string) => {
    if (window.confirm("Are you sure you want to delete this identity profile?")) {
        onDeleteIdentityProfile(id);
        if (editingProfileId === id) {
            handleNewProfile();
        }
    }
  };
  
  const handleSaveProfileForm = () => {
    if (!profileForm.name.trim()) {
        alert("Profile name cannot be empty.");
        return;
    }
    const profileData: IdentityProfile = {
        id: editingProfileId || generateUUID(),
        createdAt: editingProfileId ? identityProfiles.find(p => p.id === editingProfileId)!.createdAt : Date.now(),
        name: profileForm.name,
        content: profileForm.content,
    };
    onSaveIdentityProfile(profileData);
    if (!editingProfileId) {
        setEditingProfileId(profileData.id);
        handleSetActiveProfile(profileData.id);
    }
  };
  
  const handleSetActiveProfile = (id: string | null) => {
    onLiveUpdate({ ...settings, activeIdentityProfileId: id });
  };
  
  const handleFactChange = (factId: string, newContent: string) => {
    setProfileForm(prev => ({
        ...prev,
        content: prev.content.map(fact => 
            fact.id === factId ? { ...fact, content: newContent } : fact
        )
    }));
  };

  const handleAddFact = () => {
    const newFact: IdentityFact = { id: generateUUID(), content: '' };
    setProfileForm(prev => ({
        ...prev,
        content: [...prev.content, newFact]
    }));
  };

  const handleRemoveFact = (factId: string) => {
    setProfileForm(prev => ({
        ...prev,
        content: prev.content.filter(fact => fact.id !== factId)
    }));
  };

  return (
    <div className="p-6 overflow-y-auto space-y-8 flex-1">
      <section>
        <h3 className="text-lg font-semibold">Identity Memory (Profiles)</h3>
        <p className="text-sm text-text-secondary -mt-1 mb-4">
          Create persistent identities for the AI. The active profile's content is always included in every conversation.
        </p>
        
        {/* Warning and Usage Instructions */}
        <div className="p-4 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">⚠️ Not for Roleplay</p>
          <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
            <p>Identity Memory is designed for <strong>raw, factual information</strong> to help the AI remember you across conversations—not for roleplay scenarios.</p>
            <p className="pt-2"><strong>How to Add Content:</strong></p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li><strong>Manually:</strong> Create profiles below and add facts directly</li>
              <li><strong>From Chat:</strong> Use the <strong>"Tools"</strong> menu in the chat input → Select <strong>"Add to Identity Memory"</strong> to save information from conversations</li>
            </ul>
          </div>
        </div>
        <div className="flex-1 flex min-h-[30rem] border border-color rounded-lg">
          <aside className="w-1/3 border-r border-color flex flex-col">
            <div className="p-3">
              <button onClick={handleNewProfile} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold new-chat-btn rounded-lg">
                <PlusIcon className="w-4 h-4" /> New Profile
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {identityProfiles.map(p => (
                <div key={p.id} className="group relative">
                  <button
                    onClick={() => handleEditProfile(p)}
                    className={`w-full text-left truncate pl-3 pr-8 py-2 text-sm rounded-lg transition-colors list-item ${editingProfileId === p.id ? 'list-item-active' : ''}`}
                  >
                    {p.name}
                    {settings.activeIdentityProfileId === p.id && <span className="text-xs text-accent-primary ml-2">(Active)</span>}
                  </button>
                  <button onClick={() => handleDeleteProfile(p.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div ref={profileLoaderRef} className="h-5 flex justify-center items-center">
                {hasMoreIdentityProfiles && <LoaderIcon className="w-5 h-5" />}
              </div>
            </nav>
          </aside>
          <main className="w-2/3 p-4 space-y-4 flex flex-col">
            <h4 className="text-lg font-bold">{editingProfileId ? "Edit Profile" : "Create New Profile"}</h4>
            <div className="space-y-3 flex-1 flex flex-col">
              <div>
                <label className="block text-sm font-medium">Profile Name</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className="mt-1 block w-full px-3 py-2 border rounded-md modal-input" />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-sm font-medium mb-1">Content / Instructions</label>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {(profileForm.content || []).map((fact) => (
                    <div key={fact.id} className="flex items-center gap-2 group">
                      <textarea
                        value={fact.content}
                        onChange={(e) => {
                          handleFactChange(fact.id, e.target.value);
                          e.target.style.height = 'auto';
                          const newHeight = Math.min(e.target.scrollHeight, 200);
                          e.target.style.height = newHeight + 'px';
                        }}
                        onFocus={(e) => {
                          e.target.style.height = 'auto';
                          const newHeight = Math.min(e.target.scrollHeight, 200);
                          e.target.style.height = newHeight + 'px';
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            const newHeight = Math.min(el.scrollHeight, 200);
                            el.style.height = newHeight + 'px';
                          }
                        }}
                        rows={2}
                        className="w-full p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 modal-input min-h-[60px] max-h-[200px] overflow-y-auto"
                        placeholder="Add a fact or instruction..."
                      />
                      <button
                        onClick={() => handleRemoveFact(fact.id)}
                        className="p-2 text-text-secondary hover:text-red-500 rounded-full hover:bg-tertiary-bg opacity-50 group-hover:opacity-100"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddFact} className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-accent-primary bg-accent-primary/10 rounded-lg hover:bg-accent-primary/20 transition-colors">
                  <PlusIcon className="w-4 h-4" /> Add Fact
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <button onClick={handleSaveProfileForm} disabled={!profileForm.name.trim()} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                Save Profile
              </button>
              {editingProfileId && (
                settings.activeIdentityProfileId === editingProfileId ? (
                  <button onClick={() => handleSetActiveProfile(null)} className="px-4 py-2 text-sm font-medium text-red-500 bg-red-100 dark:bg-red-900/40 rounded-lg">
                    Deactivate
                  </button>
                ) : (
                  <button onClick={() => handleSetActiveProfile(editingProfileId)} className="px-4 py-2 text-sm font-medium btn-secondary rounded-lg">
                    Set Active
                  </button>
                )
              )}
            </div>
          </main>
        </div>
      </section>

      <section className="space-y-4 p-4 border rounded-lg border-color">
        <h3 className="text-lg font-semibold">Contextual Memory (RAG)</h3>
        <p className="text-sm text-text-secondary -mt-3">
          Uses a vector database to give conversations long-term, semantic memory.
        </p>
        <CheckboxInput
          label="Enable RAG"
          name="enabled"
          checked={settings.rag.enabled}
          onChange={(e) => handleRagInputChange(e)}
        />
        <div className={`space-y-4 ${!settings.rag.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium mb-2">Embedding Model</label>
            <select
              name="embeddingEngine"
              value={settings.rag.embeddingEngine}
              onChange={handleRagInputChange}
              className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
            >
              <option value="koboldcpp">KoboldCPP (Local)</option>
              <option value="gemini" disabled>Gemini (Cloud) - ⚠️ Under Maintenance</option>
              <option value="openai-small">OpenAI text-embedding-3-small (1536 dims)</option>
              <option value="openai-large">OpenAI text-embedding-3-large (3072 dims)</option>
            </select>
            <p className="text-xs text-text-secondary mt-1">
              KoboldCPP: Local, private, unlimited. OpenAI: High-quality cloud embeddings via OpenRouter.
            </p>
            {settings.rag.embeddingEngine === 'gemini' && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-md mt-2">
                ⚠️ <strong>Gemini Embedding Under Maintenance:</strong> Experiencing API issues. Please use KoboldCPP or OpenAI models.
              </div>
            )}
          </div>
          {settings.rag.embeddingEngine === 'gemini' && (
            <div className="pt-2 space-y-3 opacity-50 pointer-events-none">
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">
                🔒 <strong>Gemini Embedding Locked:</strong> Under maintenance due to API issues. Please select another embedding model.
              </div>
            </div>
          )}
          {(settings.rag.embeddingEngine === 'openai-small' || settings.rag.embeddingEngine === 'openai-large') && (
            <div className="pt-2 space-y-3">
              <div>
                <label className="block text-sm font-medium">Model Information</label>
                <div className="text-xs text-text-secondary bg-tertiary-bg p-3 rounded-md mt-1 space-y-1">
                  {settings.rag.embeddingEngine === 'openai-small' ? (
                    <>
                      <p><strong>Model:</strong> text-embedding-3-small</p>
                      <p><strong>Dimensions:</strong> 1536</p>
                      <p><strong>Best for:</strong> Fast processing, lower storage costs</p>
                      <p><strong>Performance:</strong> High quality, optimized for speed</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Model:</strong> text-embedding-3-large</p>
                      <p><strong>Dimensions:</strong> 3072</p>
                      <p><strong>Best for:</strong> Maximum accuracy, complex tasks</p>
                      <p><strong>Performance:</strong> Highest quality available</p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Connection Test</label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleTestOpenAIConnection(settings.rag.embeddingEngine === 'openai-small' ? 'small' : 'large')}
                    disabled={openaiTestStatus === 'loading'}
                    className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50"
                  >
                    {openaiTestStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                  </button>
                  <div className="h-4">
                    {getStatusIndicator(openaiTestStatus, "Connection failed. Check OpenRouter key.", "Connection successful!")}
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-1">Tests if your OpenRouter API key can access OpenAI embeddings.</p>
              </div>
            </div>
          )}
          {settings.rag.embeddingEngine === 'koboldcpp' && (
            <div>
              <label htmlFor="rag-koboldcppUrl" className="block text-sm font-medium">KoboldCPP URL</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  id="rag-koboldcppUrl"
                  name="koboldcppUrl"
                  value={settings.rag.koboldcppUrl}
                  onChange={handleRagInputChange}
                  className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                  placeholder="http://127.0.0.1:5001"
                />
                <button onClick={handleConnectRag} disabled={ragConnectionStatus === 'loading'} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                  {ragConnectionStatus === 'loading' ? '...' : 'Connect'}
                </button>
              </div>
              <div className="h-4 mt-1">
                {getStatusIndicator(ragConnectionStatus, undefined, `Connected to ${settings.rag.embeddingModelName}`)}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-md mt-2">
                <strong>Network Tip:</strong> For access from other devices, replace `127.0.0.1` with your machine's local IP: <code className="text-xs bg-gray-200 dark:bg-gray-700 p-1 rounded select-all">{hostname}</code>
              </div>
            </div>
          )}
          <SliderInput
            label="Top K Results"
            value={settings.rag.topK} min={1} max={20} step={1}
            onChange={(e) => handleRagInputChange(e as React.ChangeEvent<HTMLInputElement>)}
            name="topK" helpText="Number of relevant text chunks to retrieve from memory."
            dataType="integer"
          />
          <NumberInput
            label="Chunk Size (characters)"
            name="chunkSize"
            value={settings.rag.chunkSize}
            onChange={handleRagInputChange}
          />
          <p className="text-xs text-text-secondary -mt-2">
            Larger messages are split into chunks of this size before being stored in memory.
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">Context Injection Mode</label>
            <SegmentedControl 
                name="injectMode"
                value={settings.rag.injectMode}
                options={[
                    { value: 'system_prompt', label: 'System Prompt' },
                    { value: 'user_message', label: 'User Message' }
                ]}
                onChange={handleRagInputChange}
            />
            <p className="text-xs text-text-secondary mt-1">
              <strong>System Prompt:</strong> Context persists across conversation (traditional).<br/>
              <strong>User Message:</strong> Context injected temporarily per message, doesn't affect chat history visibility.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MemoryTab;