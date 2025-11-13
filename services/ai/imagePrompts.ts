import type { Message, Character, Settings, CharacterState } from '../../types';
import { callGeminiWithRetry, getPromptConfig } from '../../utils/apiHelpers';
import { PROMPT_IDS } from '../../constants';

/**
 * This module handles AI-powered transformations related to image generation prompts.
 */

/**
 * Transforms a user's message into a detailed, professional prompt suitable for
 * AI image generation models like Stable Diffusion.
 * @param targetMessageContent - The user's message to transform.
 * @param conversationHistory - The recent conversation history for context.
 * @param activeCharacters - The active characters in the conversation.
 * @param settings - Optional settings (will be fetched if not provided)
 * @returns A promise that resolves to the generated professional prompt.
 */
export const transformToImagePrompt = async (
    targetMessageContent: string,
    conversationHistory: Message[],
    activeCharacters: Character[],
    settings?: Settings
): Promise<string> => {
    // Get prompt configurations from user settings (AI Prompts tab)
    const mergePromptConfig = await getPromptConfig(PROMPT_IDS.MERGE_IMAGE_PROMPT, settings);
    const enhancePromptConfig = await getPromptConfig(PROMPT_IDS.ENHANCE_IMAGE_PROMPT, settings);

    // Analyze the last few messages for character names
    const contextText = conversationHistory
        .slice(-3) // Look at the last 3 messages for context
        .map(m => m.content)
        .join(" ")
        .toLowerCase();

    // Find ALL characters mentioned in recent context (not just the first one)
    const charactersFound: Character[] = [];
    for (const char of activeCharacters) {
        if (contextText.includes(char.name.toLowerCase()) && char.visualPrompt) {
            charactersFound.push(char);
        }
    }

    if (charactersFound.length > 0) {
        // --- Strategy 1: Found character(s) with visual prompt(s) ---
        // Merge ALL character appearances with the scene description.
        
        let characterPromptsSection = '';
        if (charactersFound.length === 1) {
            characterPromptsSection = `CHARACTER_BASE_PROMPT:
---
${charactersFound[0].visualPrompt}
---`;
        } else {
            // Multiple characters - list them all
            characterPromptsSection = charactersFound.map((char, index) => 
                `CHARACTER ${index + 1} (${char.name}) BASE_PROMPT:
---
${char.visualPrompt}
---`
            ).join('\n\n');
        }

        const userPrompt = `${characterPromptsSection}

SCENE_DESCRIPTION:
---
${targetMessageContent}
---

${charactersFound.length > 1 ? `\n⚠️ IMPORTANT: This scene includes ${charactersFound.length} characters (${charactersFound.map(c => c.name).join(', ')}). Merge ALL their visual details into a cohesive scene composition.` : ''}`;

        try {
            const response = await callGeminiWithRetry(
                {
                    model: mergePromptConfig.model,
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    config: {
                        systemInstruction: mergePromptConfig.template,
                        thinkingConfig: { thinkingBudget: 0 },
                    }
                },
                settings,
                45000 // 45 seconds timeout
            );
            const prompt = response.text;
            if (!prompt) throw new Error("AI did not return a valid merged prompt.");
            return prompt.trim();
        } catch (error: any) {
            console.error("Gemini merged prompt generation error:", error);
            throw new Error(`Gemini API Error: ${error.message || 'Failed to generate merged prompt.'}`);
        }
    } else {
        // --- Strategy 2: Fallback to general prompt enhancement ---
        try {
            const response = await callGeminiWithRetry(
                {
                    model: enhancePromptConfig.model, // ✅ Use model from AI Prompts settings
                    contents: [{ role: 'user', parts: [{ text: targetMessageContent }] }],
                    config: {
                        systemInstruction: enhancePromptConfig.template, // ✅ Use template from AI Prompts settings
                        thinkingConfig: { thinkingBudget: 0 },
                    }
                },
                settings,
                45000 // 45 seconds timeout
            );
            const prompt = response.text;
            if (!prompt) throw new Error("AI did not return a valid prompt.");
            return prompt.trim();
        } catch (error: any) {
            console.error("Gemini prompt generation error:", error);
            throw new Error(`Gemini API Error: ${error.message || 'Failed to generate prompt.'}`);
        }
    }
};

/**
 * Generates a professional scene background prompt based on recent conversation
 * and active character details. This prompt is optimized for creating atmospheric
 * fantasy-style background images suitable for chat backgrounds.
 * 
 * @param conversationHistory - Recent messages (typically last 5-10) for context
 * @param activeCharacters - Characters currently active in the conversation
 * @param characterStates - Optional character states for location/emotional context
 * @param settings - Application settings
 * @returns A promise that resolves to an English image generation prompt
 */
export const generateSceneBackgroundPrompt = async (
    conversationHistory: Message[],
    activeCharacters: Character[],
    characterStates?: CharacterState[],
    settings?: Settings
): Promise<string> => {
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_SCENE_BACKGROUND, settings);

    // Build context from recent messages (last 8 messages for better scene understanding)
    const recentMessages = conversationHistory.slice(-8);
    const conversationContext = recentMessages
        .map(m => `[${m.role === 'user' ? 'User' : 'AI'}]: ${m.content}`)
        .join('\n\n');

    // Gather character descriptions
    let characterDescriptions = '';
    if (activeCharacters.length > 0) {
        characterDescriptions = activeCharacters.map(char => {
            let desc = `**${char.name}:**\n`;
            
            // Physical description
            if (char.description) {
                desc += `Description: ${char.description}\n`;
            }
            
            // Visual details if available
            if (char.visualPrompt) {
                desc += `Visual: ${char.visualPrompt}\n`;
            }
            
            // Character state context (location, emotional state)
            const charState = characterStates?.find(cs => cs.characterId === char.id || cs.characterName === char.name);
            if (charState) {
                if (charState.current_location) {
                    desc += `Current Location: ${charState.current_location}\n`;
                }
                if (charState.emotional_state) {
                    desc += `Emotional State: ${charState.emotional_state}\n`;
                }
            }
            
            return desc;
        }).join('\n');
    }

    // Construct the full user prompt
    const userPrompt = `**RECENT CONVERSATION:**
---
${conversationContext}
---

${characterDescriptions ? `**ACTIVE CHARACTERS:**\n---\n${characterDescriptions}---\n\n` : ''}

Based on the above context, generate a professional image generation prompt for a BACKGROUND SCENE that captures the current atmosphere and location. Remember: this is for a chat background, so focus on the environment and atmosphere, not character close-ups.`;

    try {
        const response = await callGeminiWithRetry(
            {
                model: promptConfig.model,
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: promptConfig.template,
                    thinkingConfig: { thinkingBudget: 0 },
                }
            },
            settings,
            45000 // 45 seconds timeout
        );

        const prompt = response.text?.trim();
        if (!prompt) {
            throw new Error("AI did not return a valid scene background prompt.");
        }

        return prompt;
    } catch (error: any) {
        console.error("Scene background prompt generation error:", error);
        throw new Error(`Failed to generate scene background prompt: ${error.message || 'Unknown error'}`);
    }
};