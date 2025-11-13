import type { HnswlibModule } from 'hnswlib-wasm';

export type Theme = 'light' | 'dark' | 'custom';

export interface CustomThemeColors {
  primaryBg: string;
  secondaryBg: string;
  tertiaryBg: string;
  textColor: string;
  textSecondary: string;
  accentColor: string;
  accentPrimaryHover: string;
  accentText: string;
  borderColor: string;
  // Modal and form additions
  modalBg: string;
  modalTextColor: string;
  inputBg: string;
  buttonSecondaryBg: string;
  buttonSecondaryHoverBg: string;
  buttonSecondaryTextColor: string;
  // New granular additions
  messageTextColor: string;
  userMessageBg: string;
  modelMessageBg: string;
  segmentedControlBg: string;
  segmentedControlActiveBg: string;
  segmentedControlActiveText: string;
  listItemHoverBg: string;
  listItemActiveBg: string;
  listItemActiveText: string;
  // New additions for full customization
  modalHeaderBg: string;
  modalFooterBg: string;
  scrollbarThumbBg: string;
  scrollbarTrackBg: string;
}

export interface Model {
  id: string;
  name: string;
  provider: 'Google' | 'OpenRouter' | 'XAI';
  contextLengthTokens?: number;
  // Indicates whether the model supports image input (vision)
  supportsImageInput?: boolean;
  // Indicates whether the model supports audio input/output
  supportsAudio?: boolean;
  // Indicates whether the model supports extended thinking/reasoning
  supportsThinking?: boolean;
  // Indicates whether the model supports voice synthesis
  supportsVoiceSynthesis?: boolean;
  // Indicates whether the model supports deep thinking/reasoning
  supportsDeepThinking?: boolean;
}

export interface MessageSuggestion {
  type: 'directorAI' | 'livingLore' | 'manualDirectorAI';
  title: string;
  text: string;
  targetId?: string;
  targetName?: string;
  summaryOfChange?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  isGeneratingImage?: boolean;
  imageUrl?: string;
  imageGenerationProgress?: string;
  imageGenerator?: 'comfyui' | 'sdwebui' | 'huggingface' | 'xai';
  tokenCount?: number;
  type?: 'event'; // For Director AI injections
  suggestion?: MessageSuggestion;
  // New: Add fields for the message summarization feature.
  summary?: string;
  isSummarizing?: boolean;
  isSummary?: boolean; // Flag to identify summary messages
  // New: Add a field to store the full context payload sent for this message's generation.
  contextPayload?: string;
  // New: Add a field to display feedback during the safety filter retry process.
  retryStatus?: string;
  // New: Flag for temporary system messages that shouldn't be saved or displayed.
  isTemporary?: boolean;
  // New: Attached image for vision models
  attachedImage?: {
    dataUrl: string;
    mimeType: string;
  };
  // New: Single-level undo backup for Remove Filler/custom edit
  lastEditedBackup?: string; // previous content
  lastEditedReason?: 'remove_filler' | 'custom_edit';
  lastEditedAt?: number;
  // New: Dual Response feature - alternative response for comparison
  alternativeResponse?: string; // The second response content
  alternativeModel?: string; // Model ID used for alternative response
  isDualResponse?: boolean; // Flag to indicate this message has dual responses
  selectedResponse?: 'primary' | 'alternative'; // Which response is currently selected/saved
  ragSyncedResponse?: 'primary' | 'alternative'; // Which response is synced to RAG memory
}

// New: Defines the structure for the Conscious State Engine.
export interface CharacterState {
  characterId: string;
  characterName: string;
  current_location: string;
  emotional_state: string;
  last_interaction_with: string;
  // V2 extensions (optional for backward compatibility)
  mood?: string;
  dominant_emotions?: { label: string; intensity: number }[];
  lastInteractionCharacterId?: string;
  relationships?: {
    targetCharacterId: string;
    tags?: string[];
    metrics?: { trust?: number; affinity?: number; forgiveness?: number };
    lastEventId?: string;
  }[];
  commitments?: { text: string; createdAt: number; status: 'open' | 'kept' | 'broken'; evidence?: string[] }[];
  goals?: { text: string; priority?: number; status?: 'active' | 'paused' | 'done' }[];
  evidenceMessageIds?: string[];
  evidenceMemoryIds?: string[];
  confidence?: number;
}

export interface WorldState {
  scene_atmosphere: string;
  external_environment: string;
  // V2 extensions (optional)
  timeOfDay?: string;
  weather?: string;
  locationHints?: string[];
  sceneTension?: number; // 0-1
  salientEntities?: string[];
}

export interface ConversationState {
  character_states: CharacterState[];
  world_state: WorldState;
  // V2 metadata (optional)
  version?: number;
  lastUpdateAt?: number;
  conflicts?: { field: string; oldValue: any; newValue: any; reason?: string }[];
}

// New: Defines the structured output from the Will Engine's intent generation.
export interface DirectiveIntent {
  type: 'scene_opportunity' | 'character_action';
  content: string;
  reasoning: string;
}


// New: Defines a single task memory entry for tracking what the Will Engine has injected
export interface TaskMemoryEntry {
  injectedAt: number;        // Timestamp when this was injected
  intentType: 'scene_opportunity' | 'character_action'; // Type of action taken
  intentContent: string;      // The actual instruction that was injected
  reasoning: string;          // Why this action was taken
  messageCount?: number;      // At which message number this was injected
}

// New: Defines a directive for the "Will Engine" to guide character development.
export interface NarrativeDirective {
  id: string;
  targetCharacterId: string | null; // null for ad-hoc names
  targetCharacterName: string;
  goal: string;
  // NEW: Pacing becomes a descriptive enum for controlling frequency/aggressiveness.
  pacing: 'slow' | 'medium' | 'fast' | 'aggressive';
  subtlety: 'hint' | 'action' | 'confrontation';
  // New: Smart Will Engine fields
  priority?: 'low' | 'normal' | 'high' | 'urgent'; // Dynamic priority
  progress?: number; // 0-100, AI-evaluated progress
  lastChecked?: number; // Timestamp of last verification
  isCompleted?: boolean; // True when goal is achieved
  contextTriggers?: string[]; // Keywords/phrases that activate this directive
  // NEW: Hunger tracks how many turns this directive has been ignored.
  hunger?: number;
  // NEW: Task Memory - tracks all injections for this specific directive
  taskMemory?: TaskMemoryEntry[]; // History of what has been injected for this goal
}

// New: Smart AI Systems Configuration
export interface SmartSystemConfig {
  willEngine?: {
    enabled: boolean;
    verificationFrequency: number; // Check progress every X messages
    contextAnalysisFrequency: number; // Analyze context every X messages
    maxActiveDirectives: number; // Maximum number of active directives
  };
  directorAI?: {
    mode: 'frequency' | 'smart'; // 'frequency' = old system, 'smart' = new context-aware
    frequencyValue?: number; // Used only if mode = 'frequency'
    stagnationThreshold?: number; // Messages without action/drama
  };
  livingLore?: {
    mode: 'frequency' | 'smart'; // 'frequency' = old system, 'smart' = new intelligent detection
    frequencyValue?: number; // Used only if mode = 'frequency'
    significanceThreshold?: number; // 0-100, how significant must an event be
  };
  consciousState?: {
    mode: 'frequency' | 'smart'; // 'frequency' = old system, 'smart' = new emotional dynamics
    frequencyValue?: number; // Used only if mode = 'frequency'
    emotionalChangeThreshold?: number; // 0-100, how much emotional change triggers update
    // New: Engine version flag for the Conscious State Engine
    engineVersion?: 'v1' | 'v2' | 'shadow';
  };
}

// New: Defines a key fact or canon event from the conversation.
export interface ConversationFact {
  id: string;
  content: string;
  addedAt: number;
  category?: 'event' | 'relationship' | 'secret' | 'decision' | 'custom';
  isActive: boolean;
  // New: Injection mode - where to inject this fact
  injectMode?: 'system' | 'message'; // 'system' = system prompt (default), 'message' = inject as hidden user message
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  systemPrompt?: string;
  characterIds?: string[];
  lorebookIds?: string[];
  enableThinking?: boolean;
  ragCollectionName?: string;
  telegramChatId?: number;
  // Fix: Add optional model property to allow per-conversation model settings.
  model?: string;
  // New: Add properties for the optional Story Arcs feature.
  storyArcsEnabled?: boolean;
  currentLevel?: number;
  messageProgress?: number;
  // New: Add properties for the Conscious State Engine.
  consciousState?: ConversationState | null;
  consciousStateSettings?: {
    enabled: boolean;
    updateFrequency: number; // Update every N messages
    scanDepth: number; // How many recent messages to scan
  };
  // New: Add property for multi-character narrative mode control.
  multiCharacterMode?: 'director' | 'narrator';
  // New: Add scenario field to define the context/setting for the conversation.
  scenario?: string;
  // New: Add narrative directives for the "Will Engine".
  narrativeDirectives?: NarrativeDirective[];
  // New: Add smart AI systems configuration
  smartSystemConfig?: SmartSystemConfig;
  // New: Add key facts for maintaining conversation consistency.
  facts?: ConversationFact[];
  // New: Micro Prompt Cards (configurable quick one-time instructions)
  microPromptCards?: MicroPromptCard[];
  activeMicroCardIds?: string[]; // up to 3 ids
  // New: Generated songs from story context (displayed in chat flow, NOT injected in AI context)
  songs?: GeneratedSong[];
}

// New: Defines a configurable micro prompt card used to inject a one-time instruction
export interface MicroPromptCard {
  id: string;
  title: string; // e.g., "Surprise Reply"
  prompt: string; // one-time instruction content to inject
  emoji?: string; // optional visual
}

// New: Defines a story object for the long-form writing mode.
export interface Story {
  id: string;
  title: string;
  content: string;
  systemPrompt: string;
  createdAt: number;
}


// New: Defines a specific state or "arc" for a character at a certain story level.
export interface CharacterArc {
    id: string;
    startsAtLevel: number;
    description: string;
    exampleDialogue: string;
    authorNote: string;
}

export interface Character {
  id: string;
  createdAt: number;
  name: string;
  // Base properties for normal mode
  description: string;
  exampleDialogue: string;
  authorNote: string;
  // New: An array of arcs for when Story Arcs mode is enabled.
  characterArcs?: CharacterArc[];
  events?: string;
  visualPrompt?: string;
  // Optional: Character avatar image (data URL, preferably WebP for compact storage)
  imageUrl?: string;
}

export interface UserPersona {
    id: string;
    createdAt: number;
    name: string;
    description: string;
}

// New: Defines a single fact for an Identity Profile
export interface IdentityFact {
  id: string;
  content: string;
}

// New: Defines the structure for a global identity profile.
export interface IdentityProfile {
  id: string;
  createdAt: number;
  name: string;
  content: IdentityFact[];
}

export interface LorebookEntry {
    id: string;
    keywords: string;
    content: string;
}

export interface Lorebook {
    id: string;
    createdAt: number;
    name: string;
    description: string;
    entries: LorebookEntry[];
}

export interface ADetailerUnit {
    enabled: boolean;
    model: string;
    prompt: string;
    negativePrompt: string;
    confidence: number;
    maskMinRatio: number;
    maskMaxRatio: number;
    dilateErode: number;
    inpaintOnlyMasked: boolean;
    inpaintPadding: number;
    useSeparateSteps: boolean;
    steps: number;
    useSeparateCfgScale: boolean;
    cfgScale: number;
}

export interface LoraConfig {
    id: string;
    name: string;
    displayName: string;
    weight: number;
    clipStrength: number;
    triggerPhrases: string;
    includeTriggerInPrompt: boolean;
    enabled: boolean;
}

export interface ComfyUISettings {
    url: string;
    clientId: string;
    isConnected: boolean;
    checkpoint: string;
    sampler: string;
    scheduler: string;
    steps: number;
    cfg: number;
    seed: number;
    width: number;
    height: number;
    enableUpscaler: boolean;
    upscaleModel: string;
    upscaleFactor: number;
    // WebP conversion settings
    outputFormat: 'original' | 'webp-browser';
    webpQuality: number; // 0-100 for browser conversion quality
    loras: LoraConfig[];
    negativePrompt: string;
}

export interface StableDiffusionSettings {
    url: string;
    isConnected: boolean;
    checkpoint: string;
    sampler: string;
    scheduler: string;
    steps: number;
    cfg: number;
    seed: number;
    width: number;
    height: number;
    enableHiresFix: boolean;
    hiresUpscaler: string;
    hiresSteps: number;
    hiresDenoisingStrength: number;
    hiresUpscaleBy: number;
    faceRestoration: string;
    adUnits: ADetailerUnit[];
    // WebP conversion settings
    outputFormat: 'original' | 'webp-browser';
    webpQuality: number; // 0-100 for browser conversion quality
    vae: string;
    refiner: string;
    refinerSwitchAt: number;
    loras: LoraConfig[];
    negativePrompt: string;
}

export interface HuggingFaceSettings {
    apiKey: string;
    isConnected: boolean;
    model: string;
    negativePrompt: string;
    steps: number;
    guidanceScale: number;
}

export interface TelegramSettings {
  botToken: string;
  enabled: boolean;
  isConnected: boolean;
  botUsername: string;
  chatWhitelist: string; // Comma-separated chat IDs
}

// New: Defines a global story level with its own system prompt.
export interface StoryArcLevel {
    id: string;
    level: number;
    messagesToNext: number;
    systemPrompt: string;
}

// New: Defines a user-configurable prompt used by AI services.
export interface Prompt {
  id: string;
  name: string;
  description: string;
  template: string;
  model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'models/gemini-flash-latest' | 'models/gemini-flash-lite-latest';
}

// New: Defines user-configurable settings for AI writing style and behavior.
export interface WritingStyleSettings {
  userAgency: {
    enabled: boolean;
    prompt: string;
  };
  stylePreference: 'dialogueHeavy' | 'balanced' | 'descriptionHeavy' | 'none' | 'custom';
  presets: {
    dialogueHeavy: string;
    balanced: string;
    descriptionHeavy: string;

    custom: string;
  };
}

// New: Defines a scheduled job for the proactive agent.
export type ProactiveAgentService = 'gnews' | 'openweathermap' | 'prayer' | 'adhkar' | 'quotable';

export interface ProactiveAgentJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string; // Cron-like format
  service: ProactiveAgentService;
  params: Record<string, any>;
  synthesisPrompt: string;
  lastRun?: number; // Timestamp
}

export interface ProactiveAgentSettings {
  enabled: boolean;
  apiKeys: {
    gnews: string;
    openweathermap: string;
  };
  jobs: ProactiveAgentJob[];
}

export interface Settings {
  theme: Theme;
  customThemeColors: CustomThemeColors;
  fontSize: number;
  desktopPadding: number;
  messageSpacing: number;
  fontFamily: string;
  lineHeight: number;
  messageBubbleStyle: 'sharp' | 'soft' | 'rounded';
  messageStyle: 'bubble' | 'document';
  showSenderNames: boolean;
  // New: Add a setting to toggle the visibility of the "View Full Context" button.
  showFullContextButton: boolean;
  // New: Add a setting to enable strict input reformatting to prevent AI from controlling the user character.
  enableInputReformatting: boolean;
  // New: Add a setting for the Gemini 2.5 Pro "Foreshadowing" feature.
  geminiProThinkingMessages: boolean;
  // Highlight dialogue ("...") only; theme-aware colors.
  highlightDialogue: boolean;
  // Optional custom colors for dialogue in light/dark themes
  dialogueColorLight: string | null;
  dialogueColorDark: string | null;
  chatBackground: string | null;
  geminiApiKeys: string;
  openRouterApiKey: string;
  xaiApiKey: string;
  temperature: number;
  topK: number;
  topP: number;
  // New: Add maxResponseTokens to control the maximum length of AI responses.
  maxResponseTokens: number | null;
  activeUserPersonaId: string | null;
  // New: Add activeIdentityProfileId to manage the global memory profile.
  activeIdentityProfileId: string | null;
  systemPrompt: string;
  jailbreakPrompt: string;
  promptFormat: string;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string;
  defaultModelId: string;
  contextManagement: {
    strategy: 'trim' | 'summarize' | 'smart_summarize';
    summarizerModel: 'gemini' | 'koboldcpp' | 'openrouter';
    openRouterSummarizerModelId: string; // Model ID for OpenRouter summarization
    koboldcppUrl: string;
    maxContextTokens: number | null;
    // Token Counting Mode
    tokenCountingMode: 'fast' | 'accurate'; // fast = approximation, accurate = Google API batch
    autoCalibrate: boolean; // Auto-calibrate using Google API once per conversation (best balance)
    // Smart Summarization Settings
    recentZoneTokens: number; // Tokens to protect from summarization (e.g., 35000)
    compressionLevels: {
      midTerm: number;  // 0.4 = retain 40% (for mid-term zone)
      archive: number;  // 0.2 = retain 20% (for archive zone)
    };
    // Debug Mode
    debugMode: boolean; // Show detailed summarization logs in UI
  };
  rag: {
    enabled: boolean;
    // New: Add embeddingEngine to select between local and cloud embeddings.
    embeddingEngine: 'koboldcpp' | 'gemini' | 'openai-small' | 'openai-large';
    koboldcppUrl: string;
    isConnected: boolean;
    embeddingModelName: string;
    topK: number;
    chunkSize: number;
    // New: Control where RAG context is injected: system prompt or user message
    injectMode: 'system_prompt' | 'user_message';
  };
  comfyUI: ComfyUISettings;
  stableDiffusion: StableDiffusionSettings;
  huggingFace: HuggingFaceSettings;
  preferredImageGenerator: 'comfyui' | 'sdwebui' | 'huggingface' | 'xai';
  directorAI: {
    enabled: boolean;
    automatic: boolean;
    frequency: number; // Number of message pairs to wait
    scanDepth: number; // How many recent messages to scan
  };
  livingLore: {
    enabled: boolean;
    automatic: boolean;
    scanDepth: number; // How many recent messages to scan
  };
  telegram: TelegramSettings;
  // New: Global definitions for the Story Arcs system.
  storyArcs: {
    levels: StoryArcLevel[];
  };
  // New: User-configurable prompts for all AI tasks.
  prompts: Prompt[];
  // New: User-configurable settings for AI writing style.
  writingStyle: WritingStyleSettings;
  // New: Settings for the proactive agent.
  proactiveAgent: ProactiveAgentSettings;
  // New: Dual Response Sync feature settings
  dualResponse: {
    enabled: boolean;
    mode: 'same_model' | 'different_models'; // Same model twice or two different models
    primaryModel?: string; // Model ID for primary response (if different_models)
    alternativeModel?: string; // Model ID for alternative response (if different_models)
    autoSelectBest?: boolean; // Automatically select the better response (future feature)
  };
}

export interface RagMemoryTag {
  type: 'character' | 'location' | 'event' | 'theme';
  value: string;
}

// New: Defines a structured relationship for the knowledge graph.
export interface RagMemoryRelation {
  subject: string;
  predicate: string;
  object: string;
}

export interface RagMemory {
  id: string; // A unique UUID for linking and for the key
  sourceMessageIds?: string[]; // New: IDs of the user/model messages this memory is from
  timestamp: number;
  fullText: string; // The full logical chunk/scene
  summary?: string; // Optional AI-generated summary for embedding or display
  // New: Pre‑sanitized, short facts safe for prompt injection (background-only)
  // These are generated at write-time to avoid latency during retrieval.
  sanitizedFacts?: string[];
  
  // Contextual links
  previousMemoryId?: string;
  nextMemoryId?: string;

  // Semantic tags for filtering and analysis
  tags?: RagMemoryTag[];

  // Narrative importance score
  importance?: number;

  // New: Narrative emotional mood
  mood?: string;

  // New: Knowledge graph relations
  relations?: RagMemoryRelation[];
}


// --- Notification System Types ---
// Fix: Add NotificationAction type for notifications with multiple buttons and prompt support.
export interface NotificationAction {
  label: string;
  onClick: () => void;
  className?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'suggestion';
  onClick?: () => void; // A single action for the whole toast
  duration?: number; // Auto-dismiss after ms
  // Fix: Add properties for advanced notifications.
  actions?: NotificationAction[];
  showPrompt?: boolean;
  promptPlaceholder?: string;
  onPromptSubmit?: (prompt: string) => void;
}


// --- AI Service Types ---
export interface LivingLoreSuggestion {
  updateSuggested: boolean;
  type?: 'character' | 'lore';
  targetId?: string;
  targetName?: string;
  summaryOfChange?: string;
  reasoning?: string;
}

export interface LivingLoreUpdate {
    description: string;
    exampleDialogue: string;
    authorNote: string;
}

// --- Telegram API Types ---
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface GetMeSuccess {
  ok: true;
  result: TelegramUser;
}

export interface GetMeError {
  ok: false;
  description: string;
  error_code: number;
}

export type GetMeResponse = GetMeSuccess | GetMeError;

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
}

export interface TelegramMessage {
    message_id: number;
    date: number;
    chat: TelegramChat;
    from?: TelegramUser;
    text?: string;
}

export interface InlineKeyboardButton {
    text: string;
    callback_data: string;
}

export interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][];
}

export interface CallbackQuery {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    channel_post?: TelegramMessage;
    edited_channel_post?: TelegramMessage;
    callback_query?: CallbackQuery;
}

// --- API Connector Service Types ---
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: {
    name: string;
  };
}

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
}

export interface QuoteData {
  content: string;
  author: string;
}

export interface PrayerTimesData {
  date: string;
  timings: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };
  location: {
    city: string;
    country: string;
  };
  method: string;
}

export interface AdhkarData {
  title: string;
  content: string;
  category: string;
  repetitions?: number;
}

// New: Defines a briefing object for the Proactive Agent's new "Briefing Room" feature.
export interface Briefing {
  id: string;
  jobId: string;
  jobName: string;
  content: string;
  createdAt: number;
  isRead: boolean;
}

// New: Defines a log entry for the professional logging system.
export interface LogEntry {
  id?: number; // Auto-incremented by IndexedDB
  timestamp: string; // ISO 8601 format
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: string; // e.g., 'API_CALL', 'DB_OPERATION', 'UI_EVENT'
  message: string;
  payload?: any; // Optional structured data (e.g., error object, request details)
}

// New: Music generation types
export interface MusicMetadata {
  genre?: string[];
  mood?: string[];
  tempo?: 'slow' | 'medium' | 'fast' | 'variable';
  scale?: 'major' | 'minor' | 'modal';
  intensity?: number; // 0-100
  vocalStyle?: string;
  language?: 'ar' | 'en' | 'instrumental';
}

export interface SongGenerationData {
  lyrics: string;
  styles: string;
  title: string;
  metadata?: MusicMetadata;
  sunoUrl?: string; // The Suno share link (for embedding)
}

export interface GeneratedSong {
  id: string;
  title: string;
  lyrics: string;
  styles: string;
  sunoUrl?: string; // The Suno share link (for embedding)
  audioUrl?: string; // Direct audio file URL (if available)
  contextSnapshotId?: string;
  characterIds?: string[];
  timestamp: number;
  conversationId: string;
  messageId: string; // The message that triggered generation
  isWaitingForLink?: boolean; // Smart listening mode active
}

// Summarization Debug Types
export type SummarizationZone = 'archive' | 'midTerm' | 'recent';
export type SummarizationStatus = 'success' | 'fallback' | 'error';

export interface SummarizationDebugLog {
  id?: string;
  timestamp: number;
  conversationId: string;
  zone: SummarizationZone;
  inputTokens: number;
  outputTokens: number;
  retentionRate: number;
  model: string;
  status: SummarizationStatus;
  duration: number;
  chunkIndex?: number;
  totalChunks?: number;
  errorMessage?: string;
  fallbackReason?: string;
  inputPreview?: string; // First 500 chars of input
  outputSummary?: string; // Full summary result
}

export interface SummarizationSessionStats {
  conversationId: string;
  totalSummarizations: number;
  successCount: number;
  fallbackCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageDuration: number;
  lastSummarization?: number; // timestamp
}
