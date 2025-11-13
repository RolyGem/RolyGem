import { Type } from "@google/genai";
import type { Message, Character, Lorebook, LorebookEntry, StoryArcLevel, CharacterArc, Model, Settings, RagMemoryTag, RagMemoryRelation, ConversationState } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { PROMPT_IDS } from '../../constants';
import { callGeminiWithRetry, streamGeminiWithRetry, getPromptConfig } from '../../utils/apiHelpers';

/**
 * This module handles the creation and updating of persistent knowledge
 * within the application, such as characters, lorebooks, and story arcs.
 */

// Type definition for progress updates during knowledge extraction.
export type UpdateKnowledgeProgress = {
    stage: 'idle' | 'summarizing' | 'updating_characters' | 'creating_lore' | 'creating_character' | 'complete' | 'error';
    message: string;
    progress?: number; // e.g., for character updates, 1 of 3
    total?: number;
};

export interface EnrichedRagMemory {
    summary: string;
    tags: RagMemoryTag[];
    importance: number;
    relations: RagMemoryRelation[];
    mood: string;
}

// Helper for delayed retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RULE-BASED ENRICHMENT FALLBACK
 * 
 * When AI enrichment fails, this function provides a basic but functional
 * enrichment using pattern matching and heuristics.
 * 
 * @param sceneText - The scene text to enrich
 * @returns EnrichedRagMemory with basic metadata
 */
function ruleBasedEnrichment(sceneText: string): EnrichedRagMemory {
    const tags: RagMemoryTag[] = [];
    
    // 1. Extract character names (capitalized words at sentence starts or after quotes)
    const characterPattern = /(?:^|[.!?]\s+|["'](?:said|asked|replied)\s+)([A-Z][a-z]+)/g;
    const characterNames = new Set<string>();
    let match;
    while ((match = characterPattern.exec(sceneText)) !== null) {
        if (match[1] && match[1].length > 2) { // Avoid initials
            characterNames.add(match[1]);
        }
    }
    characterNames.forEach(name => tags.push({ type: 'character', value: name }));
    
    // 2. Extract locations (proper nouns, places)
    const locationKeywords = ['at', 'in', 'to', 'from', 'near', 'by', 'towards', 'through'];
    const locationPattern = new RegExp(`(?:${locationKeywords.join('|')})\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)`, 'g');
    const locations = new Set<string>();
    while ((match = locationPattern.exec(sceneText)) !== null) {
        if (match[1]) {
            locations.add(match[1]);
        }
    }
    locations.forEach(loc => tags.push({ type: 'location', value: loc }));
    
    // 3. Detect events (action verbs in past tense)
    const actionVerbs = /\b(killed|died|arrived|left|discovered|found|fought|won|lost|created|destroyed|met|saved|escaped)\b/gi;
    const events = new Set<string>();
    while ((match = actionVerbs.exec(sceneText)) !== null) {
        events.add(match[0].toLowerCase());
    }
    events.forEach(event => tags.push({ type: 'event', value: event }));
    
    // 4. Extract themes (common story themes)
    const themeKeywords = {
        love: /\b(love|romance|heart|affection|kiss|embrace)\b/gi,
        death: /\b(death|died|kill|murder|grave|funeral)\b/gi,
        war: /\b(war|battle|fight|soldier|weapon|army)\b/gi,
        mystery: /\b(mystery|secret|hidden|unknown|discover|reveal)\b/gi,
        adventure: /\b(adventure|journey|quest|explore|travel)\b/gi,
        betrayal: /\b(betray|traitor|deceive|lie|trick)\b/gi,
        hope: /\b(hope|dream|wish|aspire|future)\b/gi,
        fear: /\b(fear|afraid|terror|horror|dread|panic)\b/gi
    };
    
    for (const [theme, pattern] of Object.entries(themeKeywords)) {
        if (pattern.test(sceneText)) {
            tags.push({ type: 'theme', value: theme });
        }
    }
    
    // 5. Calculate importance based on content density
    const wordCount = sceneText.split(/\s+/).length;
    const sentenceCount = (sceneText.match(/[.!?]+/g) || []).length;
    const hasDialogue = /["']/.test(sceneText);
    const hasAction = /\b(suddenly|quickly|immediately|finally)\b/i.test(sceneText);
    
    let importance = 5; // Base importance
    if (wordCount > 200) importance += 1;
    if (sentenceCount > 10) importance += 1;
    if (hasDialogue) importance += 1;
    if (hasAction) importance += 1;
    if (tags.length > 5) importance += 1;
    importance = Math.min(10, importance);
    
    // 6. Determine mood based on emotional keywords
    const moodKeywords = {
        'Action': /\b(fight|run|chase|explode|attack|defend)\b/gi,
        'Tense': /\b(nervous|anxious|worried|tense|uneasy|pressure)\b/gi,
        'Joyful': /\b(happy|joy|laugh|smile|celebrate|delight)\b/gi,
        'Somber': /\b(sad|grief|mourn|sorrow|melancholy|gloomy)\b/gi,
        'Mysterious': /\b(mystery|strange|odd|unusual|peculiar|enigma)\b/gi,
        'Romantic': /\b(love|romance|passion|tender|intimate|affection)\b/gi,
        'Hopeful': /\b(hope|optimistic|bright|promise|future|aspire)\b/gi,
        'Humorous': /\b(funny|joke|laugh|amusing|witty|hilarious)\b/gi
    };
    
    let mood = 'Reflective'; // Default
    let maxMatches = 0;
    for (const [moodName, pattern] of Object.entries(moodKeywords)) {
        const matches = (sceneText.match(pattern) || []).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            mood = moodName;
        }
    }
    
    // 7. Create a dense summary (first 3 sentences + key information)
    const sentences = sceneText.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
    const summaryParts = sentences.slice(0, 3).join('. ');
    const keyInfo = tags.length > 0 ? ` Key elements: ${tags.slice(0, 5).map(t => t.value).join(', ')}` : '';
    const summary = (summaryParts + keyInfo).substring(0, 500) + (summaryParts.length > 500 ? '...' : '');
    
    // 8. Extract simple relations (Subject-Verb-Object patterns)
    const relations: RagMemoryRelation[] = [];
    const relationPattern = /([A-Z][a-z]+)\s+((?:is|was|has|had|became|became|fought|met|saw|told|gave))\s+([a-z]+(?:\s+[a-z]+)*)/gi;
    let relMatch;
    while ((relMatch = relationPattern.exec(sceneText)) !== null && relations.length < 5) {
        relations.push({
            subject: relMatch[1],
            predicate: relMatch[2],
            object: relMatch[3]
        });
    }
    
    console.log(`📝 Rule-based enrichment completed:
  - Tags: ${tags.length}
  - Importance: ${importance}/10
  - Mood: ${mood}
  - Relations: ${relations.length}`);
    
    return {
        summary,
        tags,
        importance,
        mood,
        relations
    };
}

/**
 * Analyzes a scene and extracts a summary, tags, importance, mood, and relations in a single API call.
 * Includes a retry mechanism for robustness.
 * @param sceneText The text content of the scene.
 * @returns A promise resolving to an object with all enriched data.
 */
export const enrichSceneForRag = async (sceneText: string): Promise<EnrichedRagMemory> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.EXTRACT_KNOWLEDGE_GRAPH);

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Using centralized API helper with retry and timeout
            const moods = ['Action', 'Tense', 'Somber', 'Joyful', 'Mysterious', 'Romantic', 'Reflective', 'Hopeful', 'Humorous'];

            const schema = {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.STRING,
                        description: "A dense, keyword-rich summary of the scene's core information, suitable for vector embedding. Focus on key actions, decisions, character emotions, new plot points, important objects, and locations. Omit conversational filler. Must be in the same language as the scene."
                    },
                    importance: {
                        type: Type.NUMBER,
                        description: "A rating from 1 (minor detail) to 10 (major plot point) of the scene's narrative importance."
                    },
                    mood: {
                        type: Type.STRING,
                        description: `The dominant emotional mood of the scene. Must be one of: ${moods.join(', ')}.`,
                        enum: moods
                    },
                    tags: {
                        type: Type.OBJECT,
                        properties: {
                            characters: { type: Type.ARRAY, items: { type: Type.STRING } },
                            locations: { type: Type.ARRAY, items: { type: Type.STRING } },
                            events: { type: Type.ARRAY, items: { type: Type.STRING } },
                            themes: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    },
                    relations: {
                        type: Type.ARRAY,
                        description: "List of relationships in Subject-Predicate-Object format.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                subject: { type: Type.STRING },
                                predicate: { type: Type.STRING },
                                object: { type: Type.STRING }
                            },
                            required: ["subject", "predicate", "object"]
                        }
                    }
                },
                required: ["summary", "importance", "mood", "tags", "relations"]
            };

            const systemPrompt = promptConfig.template; // ✅ From AI Prompts settings
            const userPrompt = `Analyze the following scene and extract all the required information into the JSON format.\n---\n${sceneText}\n---`;

            const response = await callGeminiWithRetry({
                model: promptConfig.model, // ✅ From AI Prompts settings
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1,
                    thinkingConfig: { thinkingBudget: 0 },
                }
            }, undefined, 45000);
            const jsonStr = response.text.trim();
            const result = JSON.parse(jsonStr);

            const tags: RagMemoryTag[] = [];
            (result.tags.characters || []).forEach((value: string) => tags.push({ type: 'character', value }));
            (result.tags.locations || []).forEach((value: string) => tags.push({ type: 'location', value }));
            (result.tags.events || []).forEach((value: string) => tags.push({ type: 'event', value }));
            (result.tags.themes || []).forEach((value: string) => tags.push({ type: 'theme', value }));

            // If successful, return the data and exit the loop.
            return {
                summary: result.summary || sceneText,
                importance: Math.max(1, Math.min(10, result.importance || 5)),
                mood: result.mood || 'Reflective',
                tags: tags,
                relations: result.relations || [],
            };
        } catch (error: any) {
            lastError = error;
            console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed for RAG enrichment:`, error.message);
            if (attempt < MAX_RETRIES) {
                // Exponential backoff: 1s, 2s
                await delay(attempt * 1000);
            }
        }
    }

    // If all retries fail, use intelligent fallback enrichment
    console.error("All attempts to enrich scene with Gemini failed. Falling back to rule-based enrichment. Last error:", lastError);
    return ruleBasedEnrichment(sceneText);
};

/**
 * Generates a complete character sheet from a user-provided concept using AI.
 * @param concept - A string describing the character idea.
 * @returns A promise resolving to the generated character data.
 */
export const generateCharacterSheet = async (
    concept: string
): Promise<Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'>> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_CHARACTER_SHEET);

    // Using centralized API helper with retry and timeout

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "The character's full name." },
            description: { type: Type.STRING, description: "A detailed paragraph describing the character's personality, appearance, backstory, and motivations." },
            exampleDialogue: { type: Type.STRING, description: "A multi-line example of dialogue in the format '<START>\\n{{user}}: <dialogue>\\n{{char}}: <dialogue>\\n<END>' to showcase their speaking style." },
            authorNote: { type: Type.STRING, description: "Private instructions for the AI on how to portray the character, their secrets, or narrative goals. This is not seen by the user." },
            visualPrompt: { type: Type.STRING, description: "A detailed, stable visual prompt for generating consistent character images with AI. It should include keywords for quality (masterpiece, best quality), physical features (hair, eyes, build), signature clothing or accessories, and the overall art style (e.g., fantasy digital art)." }
        },
        required: ["name", "description", "exampleDialogue", "authorNote", "visualPrompt"]
    };

    const systemPrompt = promptConfig.template; // ✅ From AI Prompts settings

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model, // ✅ From AI Prompts settings
            contents: [{
                role: 'user',
                parts: [{ text: `Character Concept: ${concept}` }]
            }],
            config: {
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 }, // Fast response
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        const characterData = JSON.parse(jsonStr);
        
        if (typeof characterData.name !== 'string' || typeof characterData.description !== 'string' || typeof characterData.visualPrompt !== 'string') {
            throw new Error("AI returned invalid data structure for character sheet.");
        }

        return characterData;

    } catch (error: any) {
        console.error("Gemini character generation error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate character sheet.'}`);
    }
};

/**
 * Generates multiple interconnected character sheets from a single concept.
 * @param concept - A string describing the group of characters and their relationships.
 * @param numCharacters - The number of characters to generate.
 * @returns A promise resolving to an array of generated character data.
 */
export const generateCharacterGroup = async (
    concept: string,
    numCharacters: number
): Promise<Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'>[]> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptDetails = await getPromptConfig(PROMPT_IDS.GENERATE_CHARACTER_GROUP);

    const characterSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            exampleDialogue: { type: Type.STRING },
            authorNote: { type: Type.STRING },
            visualPrompt: { type: Type.STRING }
        },
        required: ["name", "description", "exampleDialogue", "authorNote", "visualPrompt"]
    };

    const schema = {
        type: Type.ARRAY,
        description: `An array of exactly ${numCharacters} character sheet objects.`,
        items: characterSchema
    };

    const systemPrompt = promptDetails.template.replace(/{{numCharacters}}/g, String(numCharacters));
    const userPrompt = `Generate ${numCharacters} characters based on this concept: "${concept}"`;

    try {
        const response = await callGeminiWithRetry({
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        const charactersData = JSON.parse(jsonStr);

        if (!Array.isArray(charactersData) || charactersData.length === 0) {
            throw new Error("AI returned invalid data structure for character group.");
        }

        return charactersData;

    } catch (error: any) {
        console.error("Gemini character group generation error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate character group.'}`);
    }
};


/**
 * Generates a complete lorebook with multiple entries from a user-provided concept.
 * @param concept - A string describing the world or lore idea.
 * @returns A promise resolving to the generated lorebook data.
 */
export const generateLorebook = async (
    concept: string
): Promise<Omit<Lorebook, 'id' | 'createdAt'>> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_LOREBOOK);

    // Using centralized API helper with retry and timeout

    const entrySchema = {
        type: Type.OBJECT,
        properties: {
            keywords: { type: Type.STRING, description: "A comma-separated list of 3-5 keywords that will trigger this entry." },
            content: { type: Type.STRING, description: "The detailed information about this specific piece of lore. Should be a descriptive paragraph." }
        },
        required: ["keywords", "content"]
    };

    const lorebookSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "A creative name for the lorebook/world." },
            description: { type: Type.STRING, description: "A brief, one-paragraph overview of the lorebook's theme or world." },
            entries: { 
                type: Type.ARRAY, 
                description: "An array containing 3 to 5 detailed lore entries related to the concept.",
                items: entrySchema
            }
        },
        required: ["name", "description", "entries"]
    };

    const systemPrompt = promptConfig.template; // ✅ From AI Prompts settings

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model, // ✅ From AI Prompts settings
            contents: [{
                role: 'user',
                parts: [{ text: `World/Lorebook Concept: ${concept}` }]
            }],
            config: {
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: lorebookSchema,
            },
        });

        const jsonStr = response.text.trim();
        const lorebookData = JSON.parse(jsonStr);

        if (typeof lorebookData.name !== 'string' || !Array.isArray(lorebookData.entries)) {
            throw new Error("AI returned invalid data structure for lorebook.");
        }

        const entriesWithIds = lorebookData.entries.map((entry: Omit<LorebookEntry, 'id'>) => ({
            ...entry,
            id: generateUUID(),
        }));

        return { ...lorebookData, entries: entriesWithIds };

    } catch (error: any) {
        console.error("Gemini lorebook generation error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate lorebook.'}`);
    }
};

/**
 * Generates a multi-level story arc progression for the entire world.
 * @param concept - A high-level concept for the story.
 * @param numLevels - The number of levels/arcs to generate.
 * @returns A promise resolving to an array of generated StoryArcLevel objects.
 */
export const generateWorldStoryArcs = async (
    concept: string,
    numLevels: number,
): Promise<StoryArcLevel[]> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_WORLD_ARCS);

    // Using centralized API helper with retry and timeout

    const schema = {
        type: Type.OBJECT,
        properties: {
            levels: {
                type: Type.ARRAY,
                description: `An array of exactly ${numLevels} story arc levels.`,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        messagesToNext: { type: Type.NUMBER, description: "A reasonable number of messages to progress to the next level, typically between 30 and 70." },
                        systemPrompt: { type: Type.STRING, description: "A compelling system prompt that sets the tone, environment, and major events for this stage of the story. This prompt describes the WORLD, not a character." }
                    },
                    required: ["messagesToNext", "systemPrompt"]
                }
            }
        },
        required: ["levels"]
    };

    const systemPrompt = promptConfig.template.replace(/{{numLevels}}/g, String(numLevels)); // ✅ From AI Prompts settings

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model, // ✅ From AI Prompts settings
            contents: [{ role: 'user', parts: [{ text: `Story Concept: ${concept}` }] }],
            config: {
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const result = JSON.parse(response.text.trim());
        if (!result.levels || !Array.isArray(result.levels) || result.levels.length === 0) {
            throw new Error("AI returned an invalid structure for story arcs.");
        }
        return result.levels.map((levelData: Omit<StoryArcLevel, 'id' | 'level'>, index: number) => ({
            ...levelData,
            id: generateUUID(),
            level: index + 1,
        }));
    } catch (error: any) {
        console.error("Gemini world arc generation error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate story arcs.'}`);
    }
};

/**
 * Generates a series of character-specific arcs corresponding to world levels.
 * @param character - The base character to generate arcs for.
 * @param worldLevels - The pre-defined world levels the character will react to.
 * @param concept - A high-level concept for the character's personal journey.
 * @returns A promise resolving to an array of generated CharacterArc objects.
 */
export const generateCharacterStoryArcs = async (
    character: Character,
    worldLevels: StoryArcLevel[],
    concept: string
): Promise<CharacterArc[]> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_CHARACTER_ARCS);

    // Using centralized API helper with retry and timeout

    const schema = {
        type: Type.OBJECT,
        properties: {
            arcs: {
                type: Type.ARRAY,
                description: `An array of character arcs, one for each provided world level.`,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        startsAtLevel: { type: Type.NUMBER, description: "The level number this arc corresponds to." },
                        description: { type: Type.STRING, description: "The character's updated description for this arc, reflecting their state and personality changes." },
                        exampleDialogue: { type: Type.STRING, description: "Example dialogue that shows their new speaking style or mindset." },
                        authorNote: { type: Type.STRING, description: "Private instructions for the AI on how to portray the character during this arc." },
                    },
                    required: ["startsAtLevel", "description", "exampleDialogue", "authorNote"]
                }
            }
        },
        required: ["arcs"]
    };

    const systemPrompt = promptConfig.template; // ✅ From AI Prompts settings
    
    const userPrompt = `Base Character:
---
Name: ${character.name}
Description: ${character.description}
---

Character Journey Concept:
---
${concept}
---

World Levels & Prompts:
---
${worldLevels.map(l => `Level ${l.level}: ${l.systemPrompt}`).join('\n')}
---
Generate the corresponding character arcs in the specified JSON format.
`;

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model, // ✅ From AI Prompts settings
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const result = JSON.parse(response.text.trim());
        if (!result.arcs || !Array.isArray(result.arcs) || result.arcs.length === 0) {
            throw new Error("AI returned an invalid structure for character arcs.");
        }
        return result.arcs.map((arcData: Omit<CharacterArc, 'id'>) => ({
            ...arcData,
            id: generateUUID(),
        }));
    } catch (error: any) {
        console.error("Gemini character arc generation error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate character arcs.'}`);
    }
};

/**
 * Rewrites a selection of story text based on user instructions.
 * @param fullText - The entire current story for context.
 * @param selection - The specific text to be rewritten.
 * @param rewritePrompt - The user's instructions for the rewrite.
 * @param storySystemPrompt - The overall system prompt for the story.
 * @param model - The AI model to use.
 * @param settings - The application settings.
 * @param onChunk - Callback for streaming the rewritten text.
 * @returns A promise that resolves when the stream is complete.
 */
export const rewriteStorySelection = async (
    fullText: string,
    selection: string,
    rewritePrompt: string,
    storySystemPrompt: string,
    model: Model,
    settings: Settings,
    onChunk: (chunk: string) => void
): Promise<void> => {
    // Get prompt configuration from AI Prompts settings
    const promptConfig = await getPromptConfig(PROMPT_IDS.REWRITE_STORY_SELECTION, settings);
    if (!promptConfig) {
        throw new Error("Rewrite Story Selection prompt not found in constants.");
    }

    // Using centralized API helper with retry and timeout

    const systemPrompt = `${storySystemPrompt}\n\n${promptConfig.template}`; // ✅ From AI Prompts settings

    const userPrompt = `Here is the full story for context:
---
${fullText}
---

Here is the specific selection you must rewrite:
---
${selection}
---

Here are your instructions for the rewrite:
---
${rewritePrompt}
---

Provide ONLY the rewritten text for the selection, nothing else.`;

    try {
        await streamGeminiWithRetry({
            model: model.id.includes('gemini') ? model.id : promptConfig.model, // ✅ Use configured model as fallback
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        }, onChunk, undefined, 60000);
    } catch (error: any) {
        console.error("Gemini story rewrite error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to rewrite story selection.'}`);
    }
};


/**
 * Analyzes conversation history to update character sheets and create new lore.
 * @param messages - The messages to analyze.
 * @param focusInstructions - User-provided instructions on what to focus on.
 * @param charactersToUpdate - An array of characters to be updated.
 * @param lorebooksToCreateCount - The number of new lorebooks to create.
 * @param onSummaryChunk - A callback for streaming the summary as it's generated.
 * @param onProgress - A callback for reporting progress through the update stages.
 * @returns A promise resolving to the summary, updated characters, and new lorebooks.
 */
export const updateKnowledgeFromHistory = async (
    messages: Message[],
    focusInstructions: string,
    charactersToUpdate: Character[],
    lorebooksToCreateCount: number,
    onSummaryChunk: (chunk: string) => void,
    onProgress: (status: UpdateKnowledgeProgress) => void,
): Promise<{ summary: string, updatedCharacters: Character[], newLorebooks: Lorebook[] }> => {
    // Get prompt configurations from user settings (AI Prompts tab)
    const summaryPromptConfig = await getPromptConfig(PROMPT_IDS.KNOWLEDGE_SUMMARY);
    const charUpdatePromptConfig = await getPromptConfig(PROMPT_IDS.KNOWLEDGE_CHAR_UPDATE);
    const loreCreatePromptConfig = await getPromptConfig(PROMPT_IDS.KNOWLEDGE_LORE_CREATE);

    // Using centralized API helper with retry and timeout
    const conversationText = messages.map(m => `${m.role === 'user' ? 'User' : m.role}: ${m.content}`).join('\n\n');

    onProgress({ stage: 'summarizing', message: 'Analyzing and summarizing recent events...' });

    // Step 1: Summarize the history
    const summaryPrompt = `${summaryPromptConfig.template.replace(/{{focusInstructions}}/g, focusInstructions || 'all major plot points and character developments')}

Conversation Transcript:
---
${conversationText}
---
Summary of Events:`;

    let summary = '';
    try {
        await streamGeminiWithRetry({
            model: summaryPromptConfig.model, // ✅ From AI Prompts settings
            contents: summaryPrompt,
            config: {
                temperature: 0.3,
            },
        }, (chunkText) => {
            summary += chunkText;
            onSummaryChunk(chunkText);
        }, undefined, 90000);
        if (!summary) throw new Error("The summarization model returned an empty response.");
    } catch (e: any) {
        onProgress({ stage: 'error', message: `Summarization failed: ${e.message}` });
        throw e;
    }

    const updatedCharacters: Character[] = [];
    const newLorebooks: Lorebook[] = [];

    // Step 2: Update selected characters based on the summary
    if (charactersToUpdate.length > 0) {
        onProgress({ stage: 'updating_characters', message: 'Updating character sheets...', progress: 0, total: charactersToUpdate.length });
        
        const characterUpdateSchema = {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING, description: "The character's updated, comprehensive description reflecting their new personality, experiences, relationships, and current state. Should seamlessly integrate old and new information." },
            },
            required: ['description']
        };

        for (let i = 0; i < charactersToUpdate.length; i++) {
            const character = charactersToUpdate[i];
            onProgress({ stage: 'updating_characters', message: `Updating ${character.name}...`, progress: i + 1, total: charactersToUpdate.length });
            
            const charUpdatePrompt = `${charUpdatePromptConfig.template}

**Character Name:** ${character.name}

**Original Description:**
${character.description}

**Summary of Recent Events:**
${summary}

Updated Character Sheet:`;
            
            try {
                const response = await callGeminiWithRetry({
                    model: charUpdatePromptConfig.model, // ✅ From AI Prompts settings
                    contents: charUpdatePrompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: characterUpdateSchema,
                    },
                });
                const updatedData = JSON.parse(response.text);
                updatedCharacters.push({ ...character, ...updatedData });
            } catch (e: any) {
                 onProgress({ stage: 'error', message: `Failed to update ${character.name}: ${e.message}` });
            }
        }
    }

    // Step 3: Create new lorebooks based on the summary
    if (lorebooksToCreateCount > 0) {
        onProgress({ stage: 'creating_lore', message: `Generating ${lorebooksToCreateCount} new lore entries...` });

        const lorebookSchema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "A creative name for this new lorebook, summarizing the main theme of the recent events (e.g., 'The Whispering Caverns Arc')." },
                description: { type: Type.STRING, description: "A brief, one-paragraph overview of this collection of lore entries." },
                entries: {
                    type: Type.ARRAY,
                    description: `An array containing exactly ${lorebooksToCreateCount} detailed lore entries based on the summary.`,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            keywords: { type: Type.STRING, description: "A comma-separated list of 3-5 keywords that will trigger this entry." },
                            content: { type: Type.STRING, description: "The detailed information about this specific piece of lore. Should be a descriptive paragraph." }
                        },
                        required: ["keywords", "content"]
                    }
                }
            },
            required: ["name", "description", "entries"]
        };
        
        const lorePrompt = `${loreCreatePromptConfig.template.replace(/{{lorebooksToCreateCount}}/g, String(lorebooksToCreateCount))}

**Summary of Recent Events:**
${summary}

New Lorebook:`;

        try {
            const response = await callGeminiWithRetry({
                model: loreCreatePromptConfig.model, // ✅ From AI Prompts settings
                contents: lorePrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: lorebookSchema,
                },
            }, undefined, 60000);
            const lorebookData = JSON.parse(response.text);

            if (lorebookData && lorebookData.name && lorebookData.entries) {
                const newLorebook: Lorebook = {
                    id: generateUUID(),
                    createdAt: Date.now(),
                    name: lorebookData.name,
                    description: lorebookData.description,
                    entries: lorebookData.entries.map((entry: any) => ({
                        ...entry,
                        id: generateUUID(),
                    }))
                };
                newLorebooks.push(newLorebook);
            }
        } catch (e: any) {
            onProgress({ stage: 'error', message: `Failed to create lorebook: ${e.message}` });
        }
    }
    
    onProgress({ stage: 'complete', message: 'Knowledge update process finished!' });
    return { summary, updatedCharacters, newLorebooks };
};

/**
 * Analyzes recent messages and an old state to determine the new, current state of the world.
 * @param oldState The previous ConversationState object.
 * @param recentMessages The most recent messages to analyze for changes.
 * @returns A promise resolving to the new, updated ConversationState.
 */
export const updateConversationState = async (
    oldState: ConversationState | null,
    recentMessages: Message[],
    activeCharacters: Character[]
): Promise<ConversationState> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptDetails = await getPromptConfig(PROMPT_IDS.STATE_ENGINE_UPDATE);
    
    const characterStateSchema = {
        type: Type.OBJECT,
        properties: {
            characterId: { type: Type.STRING },
            characterName: { type: Type.STRING },
            current_location: { type: Type.STRING, description: "The character's current physical location (e.g., 'Library', 'Dubai'). Be specific if possible." },
            emotional_state: { type: Type.STRING, description: "The character's dominant current emotion (e.g., 'Anxious', 'Hopeful')." },
            last_interaction_with: { type: Type.STRING, description: "The last person or significant object the character interacted with." }
        },
        required: ["characterId", "characterName", "current_location", "emotional_state", "last_interaction_with"]
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            character_states: {
                type: Type.ARRAY,
                description: "An array of state objects, one for EACH character in the conversation.",
                items: characterStateSchema
            },
            world_state: {
                type: Type.OBJECT,
                properties: {
                    scene_atmosphere: { type: Type.STRING, description: "The general mood or atmosphere of the immediate scene (e.g., 'Tense and quiet')." },
                    external_environment: { type: Type.STRING, description: "The state of the world outside the immediate scene (e.g., 'A sandstorm is brewing')." }
                },
                required: ["scene_atmosphere", "external_environment"]
            }
        },
        required: ["character_states", "world_state"]
    };

    const conversationText = recentMessages.map(m => `${m.role === 'user' ? 'User' : m.role}: ${m.content}`).join('\n');
    const oldStateText = oldState ? JSON.stringify(oldState, null, 2) : "No previous state. This is the beginning of the story.";
    
    // Ensure the initial state includes all active characters
    const initialState: ConversationState = {
        character_states: activeCharacters.map(c => ({
            characterId: c.id,
            characterName: c.name,
            current_location: "Unknown",
            emotional_state: "Neutral",
            last_interaction_with: "None"
        })),
        world_state: {
            scene_atmosphere: "Neutral",
            external_environment: "Normal"
        }
    };

    const userPrompt = `Old State:
---
${oldStateText}
---

Recent Conversation:
---
${conversationText}
---

Active Characters (ensure every character has an entry in the output):
---
${activeCharacters.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}
---
Based on the conversation, update the state.`;

    try {
        const response = await callGeminiWithRetry({
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptDetails.template,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 },
                }
            }, undefined, 60000);
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as ConversationState;
    } catch (error: any) {
        console.error("Error updating conversation state:", error);
        // On error, return the old state if it exists, or a safe default initial state
        return oldState || initialState;
    }
};

/**
 * Creates a lorebook directly from recent conversation messages without a prior summary step.
 * The number maps to entries inside a single lorebook (like previous behavior).
 */
export const generateLorebookFromConversation = async (
    messages: Message[],
    entriesCount: number,
    focusInstructions?: string
): Promise<Omit<Lorebook, 'id' | 'createdAt'>> => {
    const promptConfig = await getPromptConfig(PROMPT_IDS.KNOWLEDGE_LORE_CREATE);

    const entrySchema = {
        type: Type.OBJECT,
        properties: {
            keywords: { type: Type.STRING },
            content: { type: Type.STRING },
        },
        required: ["keywords", "content"]
    };
    const lorebookSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            entries: { type: Type.ARRAY, items: entrySchema },
        },
        required: ["name", "description", "entries"]
    };

    const excerpt = messages.map(m => `${m.role}: ${m.content}`).join('\\n');
    const focusLine = focusInstructions ? `Focus: ${focusInstructions}\\n\\n` : '';
    const lorePrompt = `${promptConfig.template.replace(/\\{\\{lorebooksToCreateCount\\}\\}/g, String(entriesCount))}\\n\\n${focusLine}Conversation Excerpt (use as the event summary):\\n---\\n${excerpt}\\n---\\n\\nNew Lorebook:`;

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model,
            contents: lorePrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: lorebookSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        }, undefined, 60000);

        const jsonStr = response.text?.trim();
        const data = JSON.parse(jsonStr || '{}');
        if (!data || typeof data.name !== 'string' || !Array.isArray(data.entries)) {
            throw new Error('AI returned invalid lorebook data');
        }
        return data;
    } catch (error: any) {
        console.error('Gemini lorebook-from-conversation error:', error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate lorebook from conversation.'}`);
    }
};

/**
 * Generates a character sheet directly from recent conversation messages.
 * Optionally target a specific character name.
 */
export const generateCharacterFromConversation = async (
    messages: Message[],
    options?: { targetName?: string; focusInstructions?: string }
): Promise<Omit<Character, 'id' | 'createdAt' | 'events' | 'characterArcs'>> => {
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_CHARACTER_SHEET);

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            exampleDialogue: { type: Type.STRING },
            authorNote: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
        },
        required: ["name", "description", "exampleDialogue", "authorNote", "visualPrompt"]
    };

    const excerpt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const targetLine = options?.targetName ? `Target Character Name: ${options.targetName}\n` : '';
    const focusLine = options?.focusInstructions ? `Focus: ${options.focusInstructions}\n` : '';

    const userPrompt = `${targetLine}${focusLine}Conversation Excerpt:
---
${excerpt}
---

**CRITICAL TASK:** Create a fully realized character sheet based ONLY on what is implied or stated in the excerpt.

**🎯 SPECIAL INSTRUCTIONS FOR "exampleDialogue" FIELD:**

⚠️ **CRITICAL:** The "exampleDialogue" field should contain a **TEXT DESCRIPTION** of their speaking style, NOT actual dialogue examples!

❌ **WRONG (Do NOT do this):**
exampleDialogue: "{{char}}: I'm here, my love.
{{char}}: Don't worry, I'll stay with you."

✅ **CORRECT (Do this instead):**
exampleDialogue: "Speaks in a tender, calm way with a soothing voice. Frequently uses affectionate words like 'my love' and 'dear'. The tone is gentle and reassuring, yet becomes firm when needed. Prefers short, clear sentences when expressing feelings."

**📝 What to include in the speaking style description:**
1. **General Tone:** (calm, aggressive, playful, serious, sarcastic, gentle, firm)
2. **Voice Characteristics:** (soft, rough, whispery, loud, choppy)
3. **Formality Level:** (formal, casual, mix)
4. **Common Words/Phrases:** (frequently used expressions, signature lines)
5. **Sentence Structure:** (long, short, complex, simple)
6. **Emotional Expression:** (direct, reserved, emotional, cold)
7. **Context-Based Changes:** (e.g., "When speaking with Adel they are light and gentle, but occasionally playful-challenging")

**✅ EXAMPLE (Arabic character):**
"Usually speaks softly and calmly with a warm voice. With close friends like Adel the speech becomes playful, sometimes teasing in a friendly way. Prefers short, clear sentences. Expresses feelings honestly but gently, and occasionally sprinkles casual slang to show closeness."

**✅ EXAMPLE (English character):**
"Speaks in a calm, measured tone with deliberate pauses. Voice is deep and authoritative. Uses formal language most of the time, but softens when speaking to close friends. Tends to use short, declarative sentences. Expresses emotions subtly through tone rather than words. Occasionally uses sarcasm when frustrated."

**Your Output:**
- "exampleDialogue" field must be a **descriptive paragraph** (50-150 words) analyzing their speaking style
- Write in the same language as the conversation
- Be specific about tone, voice, word choice, and how it changes in different contexts
- DO NOT write actual dialogue examples with {{char}}: format

If a Target Character Name is provided, use that exact name and analyze ONLY that character's speaking style from the conversation.`;

    try {
        const response = await callGeminiWithRetry({
            model: promptConfig.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptConfig.template,
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 0 },
            },
        }, undefined, 60000);

        const jsonStr = response.text?.trim();
        const data = JSON.parse(jsonStr || '{}');
        if (!data || typeof data.name !== 'string') {
            throw new Error('AI returned invalid character data');
        }
        // If targetName provided, enforce consistency
        if (options?.targetName && data.name && typeof data.name === 'string') {
            data.name = options.targetName;
        }
        return data;
    } catch (error: any) {
        console.error('Gemini character-from-conversation error:', error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to generate character from conversation.'}`);
    }
};

/**
 * Conscious State Engine V2
 * Produces and merges delta-style updates with evidence and confidence, applying
 * conservative thresholds to prevent oscillation. Backward compatible: returns
 * a full ConversationState object.
 */
export const updateConversationStateV2 = async (
    oldState: ConversationState | null,
    recentMessages: Message[],
    activeCharacters: Character[],
    settings?: Settings
): Promise<ConversationState> => {
    // Prompt configuration for delta-style updates
    const promptDetails = await getPromptConfig(PROMPT_IDS.STATE_ENGINE_DELTA, settings as any);

    // Build minimal initial state for safety/fallback
    const initialState: ConversationState = {
        character_states: activeCharacters.map(c => ({
            characterId: c.id,
            characterName: c.name,
            current_location: "Unknown",
            emotional_state: "Neutral",
            last_interaction_with: "None"
        })),
        world_state: {
            scene_atmosphere: "Neutral",
            external_environment: "Normal"
        },
        version: 1,
        lastUpdateAt: Date.now()
    };

    const baseState: ConversationState = oldState ? { ...oldState } : initialState;

    // Compose concise conversation excerpt
    const conversationText = recentMessages.map((m, idx) => `${idx + 1}. ${m.role}: ${m.content}`).join('\n');
    const oldStateText = JSON.stringify(baseState, null, 2);
    const activeList = activeCharacters.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');

    // Schema definition for the delta output
    const charDeltaItem = {
        type: Type.OBJECT,
        properties: {
            characterId: { type: Type.STRING },
            set: {
                type: Type.OBJECT,
                properties: {
                    current_location: { type: Type.STRING },
                    emotional_state: { type: Type.STRING },
                    last_interaction_with: { type: Type.STRING },
                    lastInteractionCharacterId: { type: Type.STRING },
                    mood: { type: Type.STRING },
                    dominant_emotions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                label: { type: Type.STRING },
                                intensity: { type: Type.NUMBER }
                            },
                            required: ["label", "intensity"]
                        }
                    },
                    // Simplified relationship metrics
                    relationships: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                targetCharacterId: { type: Type.STRING },
                                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                                metrics: {
                                    type: Type.OBJECT,
                                    properties: {
                                        trust: { type: Type.NUMBER },
                                        affinity: { type: Type.NUMBER },
                                        forgiveness: { type: Type.NUMBER }
                                    }
                                }
                            },
                            required: ["targetCharacterId"]
                        }
                    }
                }
            },
            evidenceMessageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.NUMBER }
        },
        required: ["characterId"]
    } as any;

    const schema = {
        type: Type.OBJECT,
        properties: {
            characterDeltas: { type: Type.ARRAY, items: charDeltaItem },
            worldDelta: {
                type: Type.OBJECT,
                properties: {
                    scene_atmosphere: { type: Type.STRING },
                    external_environment: { type: Type.STRING },
                    timeOfDay: { type: Type.STRING },
                    weather: { type: Type.STRING },
                    sceneTension: { type: Type.NUMBER }
                }
            },
            notes: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    };

    const userPrompt = `Old State:\n---\n${oldStateText}\n---\n\nActive Characters:\n---\n${activeList}\n---\n\nRecent Conversation:\n---\n${conversationText}\n---\n\nPropose ONLY the minimal deltas.`;

    try {
        const response = await callGeminiWithRetry({
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptDetails.template,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 },
            }
        }, settings as any, 60000);

        const jsonStr = response.text?.trim?.() || '';
        const delta = jsonStr ? JSON.parse(jsonStr) : { characterDeltas: [], worldDelta: {} };

        // Merge with conservative thresholds (basic hysteresis)
        const merged: ConversationState = {
            character_states: [...baseState.character_states.map(s => ({ ...s }))],
            world_state: { ...baseState.world_state },
            version: (baseState.version || 1) + 1,
            lastUpdateAt: Date.now(),
            conflicts: baseState.conflicts ? [...baseState.conflicts] : []
        };

        const clamp01 = (v: number | undefined) => v == null ? undefined : Math.max(0, Math.min(1, v));

        // Apply character deltas
        (delta.characterDeltas || []).forEach((cd: any) => {
            const idx = merged.character_states.findIndex(c => c.characterId === cd.characterId);
            if (idx === -1) {
                // Create new entry if not found
                merged.character_states.push({
                    characterId: cd.characterId,
                    characterName: activeCharacters.find(a => a.id === cd.characterId)?.name || cd.characterId,
                    current_location: cd.set?.current_location || 'Unknown',
                    emotional_state: cd.set?.emotional_state || 'Neutral',
                    last_interaction_with: cd.set?.last_interaction_with || 'None',
                    lastInteractionCharacterId: cd.set?.lastInteractionCharacterId,
                    mood: cd.set?.mood,
                    dominant_emotions: cd.set?.dominant_emotions,
                    relationships: cd.set?.relationships,
                    evidenceMessageIds: cd.evidenceMessageIds,
                    confidence: clamp01(cd.confidence)
                });
                return;
            }

            const curr = merged.character_states[idx];
            const set = cd.set || {};

            // Basic hysteresis: only update fields if changed meaningfully or previously unknown
            if (set.current_location && set.current_location !== curr.current_location) {
                curr.current_location = set.current_location;
            }
            if (set.emotional_state && set.emotional_state !== curr.emotional_state) {
                curr.emotional_state = set.emotional_state;
            }
            if (set.last_interaction_with && set.last_interaction_with !== curr.last_interaction_with) {
                curr.last_interaction_with = set.last_interaction_with;
            }
            if (set.lastInteractionCharacterId && set.lastInteractionCharacterId !== curr.lastInteractionCharacterId) {
                curr.lastInteractionCharacterId = set.lastInteractionCharacterId;
            }
            if (set.mood) curr.mood = set.mood;
            if (set.dominant_emotions) curr.dominant_emotions = set.dominant_emotions;
            if (set.relationships) curr.relationships = set.relationships;

            // Evidence + confidence aggregation
            if (cd.evidenceMessageIds) {
                const prior = new Set(curr.evidenceMessageIds || []);
                (cd.evidenceMessageIds as string[]).forEach((id: string) => prior.add(id));
                curr.evidenceMessageIds = Array.from(prior);
            }
            if (typeof cd.confidence === 'number') {
                const prev = typeof curr.confidence === 'number' ? curr.confidence : 0.5;
                curr.confidence = clamp01((prev + cd.confidence) / 2);
            }
        });

        // Apply world delta
        const wd = delta.worldDelta || {};
        if (wd.scene_atmosphere) merged.world_state.scene_atmosphere = wd.scene_atmosphere;
        if (wd.external_environment) merged.world_state.external_environment = wd.external_environment;
        if (wd.timeOfDay) merged.world_state.timeOfDay = wd.timeOfDay;
        if (wd.weather) merged.world_state.weather = wd.weather;
        if (typeof wd.sceneTension === 'number') merged.world_state.sceneTension = clamp01(wd.sceneTension);

        return merged;
    } catch (error: any) {
        console.error('Error updating conversation state (V2):', error?.message || error);
        return oldState || initialState;
    }
};
