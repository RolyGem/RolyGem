import Dexie, { type Table } from 'dexie';
import type { Conversation, Settings, Character, Lorebook, UserPersona, RagMemory, Story, Prompt, IdentityProfile, Briefing, LogEntry } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PROMPTS } from '../constants';

// Fix: Refactored Dexie initialization to resolve type errors where methods like '.version()' and '.transaction()'
// were not found on the subclassed Dexie instance. This new pattern avoids subclassing and uses type
// augmentation on a direct Dexie instance, which is a more stable approach with TypeScript.
export const db = new Dexie('geminiFusionDB') as Dexie & {
  // 'key' is the primary key for settings. It will be 'currentUser'.
  settings: Table<Settings & { key: string }, string>;
  conversations: Table<Conversation, string>;
  characters: Table<Character, string>;
  lorebooks: Table<Lorebook, string>;
  userPersonas: Table<UserPersona, string>;
  identityProfiles: Table<IdentityProfile, string>;
  ragMetadata: Table<RagMemory & { key: string }, string>;
  stories: Table<Story, string>;
  briefings: Table<Briefing, string>;
  logs: Table<LogEntry, number>; // New: Add logs table
};

db.version(7).stores({
  settings: 'key',
  conversations: 'id, createdAt, telegramChatId',
  characters: 'id, createdAt',
  lorebooks: 'id, createdAt',
  userPersonas: 'id, createdAt',
  identityProfiles: 'id, createdAt',
  ragMetadata: 'key',
  stories: 'id, createdAt',
  briefings: 'id, createdAt, isRead',
  logs: '++id, timestamp, level, category', // New: Add logs table with indexes
});

db.version(6).stores({
  settings: 'key',
  conversations: 'id, createdAt, telegramChatId',
  characters: 'id, createdAt',
  lorebooks: 'id, createdAt',
  userPersonas: 'id, createdAt',
  identityProfiles: 'id, createdAt',
  ragMetadata: 'key',
  stories: 'id, createdAt',
  briefings: 'id, createdAt, isRead',
});

db.version(5).stores({
  settings: 'key',
  conversations: 'id, createdAt, telegramChatId',
  characters: 'id, createdAt',
  lorebooks: 'id, createdAt',
  userPersonas: 'id, createdAt',
  identityProfiles: 'id, createdAt',
  ragMetadata: 'key',
  stories: 'id, createdAt',
});


// --- Conversation Functions ---
export const getAllConversations = (limit?: number, offset?: number): Promise<Conversation[]> => {
  let query = db.conversations.orderBy('createdAt').reverse();
  if (offset) query = query.offset(offset);
  if (limit) query = query.limit(limit);
  return query.toArray();
};

export const getConversation = (id: string): Promise<Conversation | undefined> => {
    return db.conversations.get(id);
};

export const saveConversation = (conversation: Conversation): Promise<string> => {
  return db.conversations.put(conversation);
};

export const deleteConversation = (id: string): Promise<void> => {
  return db.conversations.delete(id);
};

export const getConversationByTelegramChatId = (chatId: number): Promise<Conversation | undefined> => {
    return db.conversations.where('telegramChatId').equals(chatId).first();
};

// Fix for line 91: Type 'unknown[]' is not assignable to type 'number[]'.
// The previous implementation likely used .keys(), which returns the primary keys (strings) instead of the indexed 'telegramChatId' values.
// This new implementation correctly fetches the conversation objects, extracts the numeric chat IDs, and ensures type safety.
export const getAllTelegramChatIds = async (): Promise<number[]> => {
    // @google/genai-codelab-user-troubleshooting: FIX: Correctly process the array of conversations to extract chat IDs.
    // The previous implementation using `.keys()` would return `unknown[]`, causing a type error.
    // This implementation correctly gets `Conversation[]`, maps to `(number | undefined)[]`, and then filters to `number[]`.
    const conversations = await db.conversations.where('telegramChatId').above(0).toArray();
    const chatIds = conversations
        .map(c => c.telegramChatId)
        .filter((id): id is number => typeof id === 'number');
    return [...new Set(chatIds)]; // Return unique IDs
};

// --- Story Functions ---
export const getAllStories = (limit?: number, offset?: number): Promise<Story[]> => {
  let query = db.stories.orderBy('createdAt').reverse();
  if (offset) query = query.offset(offset);
  if (limit) query = query.limit(limit);
  return query.toArray();
};

export const getStory = (id: string): Promise<Story | undefined> => {
    return db.stories.get(id);
};

export const saveStory = (story: Story): Promise<string> => {
  return db.stories.put(story);
};

export const deleteStory = (id: string): Promise<void> => {
  return db.stories.delete(id);
};


// --- Settings Functions ---
const SETTINGS_KEY = 'currentUser';
export const getSettings = async (): Promise<Settings> => {
  const saved = await db.settings.get(SETTINGS_KEY);
  if (saved) {
    const { key, ...savedSettings } = saved;

    // New: Smartly merge prompts to preserve user changes while adding new defaults.
    const savedPromptsMap = new Map((savedSettings.prompts || []).map(p => [p.id, p]));
    const mergedPrompts = DEFAULT_PROMPTS.map(defaultPrompt => 
        savedPromptsMap.has(defaultPrompt.id) 
            ? savedPromptsMap.get(defaultPrompt.id)! 
            : defaultPrompt
    );

    // Perform a deep merge-like operation to ensure all fields from DEFAULT_SETTINGS are present.
    // This prevents errors when new settings fields are added in an update.
    const fullSettings: Settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      prompts: mergedPrompts, // Use the merged prompts
      customThemeColors: {
        ...DEFAULT_SETTINGS.customThemeColors,
        ...(savedSettings.customThemeColors || {}),
      },
      contextManagement: {
        ...DEFAULT_SETTINGS.contextManagement,
        ...(savedSettings.contextManagement || {}),
      },
      rag: {
        ...DEFAULT_SETTINGS.rag,
        ...(savedSettings.rag || {}),
      },
      comfyUI: {
        ...DEFAULT_SETTINGS.comfyUI,
        ...(savedSettings.comfyUI || {}),
      },
      stableDiffusion: {
        ...DEFAULT_SETTINGS.stableDiffusion,
        ...(savedSettings.stableDiffusion || {}),
        // Ensure adUnits is a correctly structured array.
        adUnits: DEFAULT_SETTINGS.stableDiffusion.adUnits.map((defaultUnit, i) => ({
          ...defaultUnit,
          ...(savedSettings.stableDiffusion?.adUnits?.[i] || {}),
        })),
      },
      huggingFace: {
        ...DEFAULT_SETTINGS.huggingFace,
        ...(savedSettings.huggingFace || {}),
      },
      directorAI: {
        ...DEFAULT_SETTINGS.directorAI,
        ...(savedSettings.directorAI || {}),
      },
      livingLore: {
        ...DEFAULT_SETTINGS.livingLore,
        ...(savedSettings.livingLore || {}),
      },
      telegram: {
        ...DEFAULT_SETTINGS.telegram,
        ...(savedSettings.telegram || {}),
      },
      // New: Safely merge Story Arcs settings.
      storyArcs: {
        ...DEFAULT_SETTINGS.storyArcs,
        ...(savedSettings.storyArcs || {}),
      },
      writingStyle: {
        ...DEFAULT_SETTINGS.writingStyle,
        ...(savedSettings.writingStyle || {}),
        userAgency: {
          ...DEFAULT_SETTINGS.writingStyle.userAgency,
          ...(savedSettings.writingStyle?.userAgency || {}),
        },
        presets: {
          ...DEFAULT_SETTINGS.writingStyle.presets,
          ...(savedSettings.writingStyle?.presets || {}),
        },
      },
      // New: Safely merge Proactive Agent settings.
      proactiveAgent: {
        ...DEFAULT_SETTINGS.proactiveAgent,
        ...(savedSettings.proactiveAgent || {}),
        apiKeys: {
          ...DEFAULT_SETTINGS.proactiveAgent.apiKeys,
          ...(savedSettings.proactiveAgent?.apiKeys || {}),
        },
      },
    };
    // Clean up deprecated layoutMode if it exists from older settings
    if ('layoutMode' in (fullSettings as any)) {
      delete (fullSettings as any).layoutMode;
    }
    return fullSettings;
  }
  return DEFAULT_SETTINGS;
};


export const saveSettings = (settings: Settings): Promise<string> => {
  return db.settings.put({ ...settings, key: SETTINGS_KEY });
};

// --- Character Functions ---
export const getAllCharacters = (limit?: number, offset?: number): Promise<Character[]> => {
  let query = db.characters.orderBy('createdAt').reverse();
  if (offset) query = query.offset(offset);
  if (limit) query = query.limit(limit);
  return query.toArray();
};

export const saveCharacter = (character: Character): Promise<string> => {
  return db.characters.put(character);
};

export const deleteCharacter = (id: string): Promise<void> => {
  return db.characters.delete(id);
};

// --- Lorebook Functions ---
export const getAllLorebooks = (limit?: number, offset?: number): Promise<Lorebook[]> => {
    let query = db.lorebooks.orderBy('createdAt').reverse();
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.toArray();
};
  
export const saveLorebook = (lorebook: Lorebook): Promise<string> => {
    return db.lorebooks.put(lorebook);
};
  
export const deleteLorebook = (id: string): Promise<void> => {
    return db.lorebooks.delete(id);
};

// --- User Persona Functions ---
export const getAllUserPersonas = (limit?: number, offset?: number): Promise<UserPersona[]> => {
    let query = db.userPersonas.orderBy('createdAt').reverse();
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.toArray();
};
    
export const saveUserPersona = (persona: UserPersona): Promise<string> => {
    return db.userPersonas.put(persona);
};

export const deleteUserPersona = (id: string): Promise<void> => {
    return db.userPersonas.delete(id);
};

// --- Identity Profile Functions ---
export const getAllIdentityProfiles = (limit?: number, offset?: number): Promise<IdentityProfile[]> => {
    let query = db.identityProfiles.orderBy('createdAt').reverse();
    if (offset) query = query.offset(offset);
    if (limit) query = query.limit(limit);
    return query.toArray();
};
    
export const saveIdentityProfile = (profile: IdentityProfile): Promise<string> => {
    return db.identityProfiles.put(profile);
};

export const deleteIdentityProfile = (id: string): Promise<void> => {
    return db.identityProfiles.delete(id);
};

// --- RAG Metadata Functions ---
export const getRagMetadataForCollection = async (collectionName: string): Promise<RagMemory[]> => {
    const records = await db.ragMetadata.where('key').startsWith(`${collectionName}:`).toArray();
    // Return records with their 'key' property removed, matching the RagMemory interface.
    return records.map(record => {
        const { key, ...ragMemory } = record;
        return ragMemory as RagMemory;
    });
};

export const saveRagMetadataForCollection = async (collectionName: string, memories: RagMemory[]): Promise<void> => {
    await db.transaction('rw', db.ragMetadata, async () => {
        // This is a full replacement, so clear existing data first for this collection.
        await db.ragMetadata.where('key').startsWith(`${collectionName}:`).delete();
        
        // Add new metadata using the stable `id` from the memory object for the key.
        for (const mem of memories) {
            const key = `${collectionName}:${mem.id}`;
            await db.ragMetadata.put({ ...mem, key });
        }
    });
};

export const deleteRagMetadataForCollection = async (collectionName: string): Promise<void> => {
    await db.ragMetadata.where('key').startsWith(`${collectionName}:`).delete();
};

// --- Briefing Functions ---
export const getAllBriefings = (): Promise<Briefing[]> => {
  return db.briefings.orderBy('createdAt').reverse().toArray();
};

export const saveBriefing = (briefing: Briefing): Promise<string> => {
  return db.briefings.put(briefing);
};

export const getUnreadBriefingCount = (): Promise<number> => {
  return db.briefings.where({ isRead: 0 }).count();
};

export const deleteBriefing = (id: string): Promise<void> => {
  return db.briefings.delete(id);
};