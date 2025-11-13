import { Type } from "@google/genai";
import type { Settings, Message, SongGenerationData, Character } from '../../types';
import { callGeminiWithRetry, getPromptConfig } from '../../utils/apiHelpers';
import { PROMPT_IDS } from '../../constants';
import { log } from '../loggingService';

/**
 * Generates a short, descriptive title for a conversation based on the first two messages.
 * @param firstUserMessage The content of the user's first message.
 * @param firstModelResponse The content of the model's first response.
 * @param settings Optional settings (will be fetched if not provided)
 * @returns A promise that resolves to the generated title string.
 */
export const generateConversationTitle = async (
    firstUserMessage: string,
    firstModelResponse: string,
    settings?: Settings,
): Promise<string> => {
    try {
        // Get prompt configuration from user settings (AI Prompts tab)
        const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_CONVERSATION_TITLE, settings);
        const systemPrompt = promptConfig.template;

    const userPrompt = `CONVERSATION START:
---
User: ${firstUserMessage}
Model: ${firstModelResponse}
---
TITLE:`;
    
        const response = await callGeminiWithRetry(
            {
                model: promptConfig.model, // ✅ From AI Prompts settings
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.3,
                    thinkingConfig: { thinkingBudget: 0 },
                }
            },
            settings,
            15000 // 15 seconds timeout (quick task)
        );
        const title = response.text.trim().replace(/"/g, '');
        if (!title) {
            // Fallback to original method if AI fails
            return firstUserMessage.substring(0, 40) + '...';
        }
        return title;
    } catch (error: any) {
        console.error("Gemini title generation error:", error);
        // Fallback to original method on error
        return firstUserMessage.substring(0, 40) + '...';
    }
};

/**
 * Analyzes the last N messages in a conversation and generates a song
 * (lyrics, musical style, title) that captures the narrative essence.
 * 
 * @param messages - Full message history
 * @param triggerMessageId - The message ID that triggered the song generation
 * @param settings - Application settings
 * @param characters - Active characters (optional, for voice inference)
 * @param contextDepth - Number of recent messages to analyze (default: 20)
 * @param customInstructions - Optional custom instructions from user
 * @returns SongGenerationData object with lyrics, styles, and title
 */
export const generateSongFromContext = async (
  messages: Message[],
  triggerMessageId: string,
  settings: Settings,
  characters?: Character[],
  contextDepth: number = 20,
  customInstructions?: string
): Promise<SongGenerationData> => {
  try {
    log('INFO', 'MUSIC_GENERATION', `Starting song generation from context (depth: ${contextDepth})`);

    // Get the last N messages for context
    const contextMessages = messages.slice(-contextDepth);
    
    if (contextMessages.length === 0) {
      throw new Error('No messages available for context analysis');
    }

    // Format messages for analysis
    const conversationContext = contextMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Character'}: ${m.content}`)
      .join('\n\n');

    // Get prompt configuration
    const promptConfig = await getPromptConfig(PROMPT_IDS.GENERATE_SONG_FROM_CONTEXT, settings);

    // Build character context if available
    let characterContext = '';
    if (characters && characters.length > 0) {
      characterContext = `\n\nActive Characters:\n${characters.map(c => 
        `- ${c.name}: ${c.description.substring(0, 100)}...`
      ).join('\n')}`;
    }

    // Build custom instructions if provided
    const customInstructionsText = customInstructions 
      ? `\n\n**ADDITIONAL CUSTOM INSTRUCTIONS FROM USER:**\n${customInstructions}\n\nPlease follow these instructions while maintaining the overall quality and structure.`
      : '';

    const userPrompt = `Conversation Context (last ${contextMessages.length} messages):\n---\n${conversationContext}\n---${characterContext}${customInstructionsText}\n\nAnalyze this conversation and create a complete song that captures its emotional essence and narrative themes.`;

    // Define JSON schema for structured output
    const schema = {
      type: Type.OBJECT,
      properties: {
        lyrics: {
          type: Type.STRING,
          description: "Complete song lyrics with section markers ([Verse 1], [Chorus], etc.) in the conversation's language"
        },
        styles: {
          type: Type.STRING,
          description: "Detailed musical style description in English (genre, tempo, vocals, mood, instrumentation)"
        },
        title: {
          type: Type.STRING,
          description: "Song title in the conversation's language (2-5 words)"
        }
      },
      required: ["lyrics", "styles", "title"]
    };

    log('INFO', 'MUSIC_GENERATION', `Calling Gemini with model: ${promptConfig.model}`);

    // Call Gemini with retry mechanism
    const response = await callGeminiWithRetry(
      {
        model: promptConfig.model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: promptConfig.template,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.9, // Higher creativity for songwriting
          thinkingConfig: { thinkingBudget: 0 },
        }
      },
      settings,
      60000 // 60 seconds timeout for creative generation
    );

    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      throw new Error('Empty response from AI');
    }

    const songData = JSON.parse(jsonStr) as SongGenerationData;

    // Validation
    if (!songData.lyrics || !songData.styles || !songData.title) {
      throw new Error('Invalid song data structure from AI');
    }

    log('INFO', 'MUSIC_GENERATION', `Song generated successfully: "${songData.title}"`);

    return songData;
  } catch (error) {
    log('ERROR', 'MUSIC_GENERATION', `Failed to generate song: ${error}`);
    throw new Error(`Song generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};