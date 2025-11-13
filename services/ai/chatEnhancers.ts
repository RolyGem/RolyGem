import { Type } from "@google/genai";
import type { Settings, Message } from '../../types';
import { PROMPT_IDS } from '../../constants';
import { callGeminiWithRetry, streamGeminiWithRetry, getPromptConfig } from '../../utils/apiHelpers';

/**
 * Streams an AI-generated response from the user's perspective to continue a conversation.
 * Simulates a "conversation autopilot".
 */
export const streamAutopilotResponse = async (
    lastTenModelMessages: string,
    userName: string,
    characterNames: string,
    onChunk: (text: string) => void,
    settings?: Settings,
): Promise<void> => {
    const systemPrompt = `You are the user, named "${userName}". You are talking to a character (or characters) named "${characterNames}". Read the last few messages from the character. Your task is to write a short, natural, and engaging reply from the user's perspective to continue the conversation. Do not be overly verbose. Your response must be in Arabic. Just provide the text of the reply, nothing else.`;
    
    const userPrompt = `The character's last messages:
---
${lastTenModelMessages}
---
Your reply as ${userName} (in Arabic):`;

    await streamGeminiWithRetry(
        {
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.85,
                topK: 30,
                topP: 0.9,
                thinkingConfig: { thinkingBudget: 0 }, // Fast response
            }
        },
        onChunk,
        settings,
        45000 // 45 seconds timeout
    );
};

/**
 * Streams an improved version of a user's prompt, making it more descriptive and polished.
 */
export const streamPromptPolish = async (
    originalText: string,
    onChunk: (text: string) => void,
    settings?: Settings,
): Promise<void> => {
    const systemPrompt = `You are a master writer and prompt engineer. A user has written a piece of text for a story in Arabic. Your task is to polish and improve it. Make it more descriptive, clear, and evocative. Correct any grammatical errors. The output must be in Arabic and a direct replacement for the original text. Do not add any commentary. Just provide the improved text.`;

    await streamGeminiWithRetry(
        {
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: originalText }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                thinkingConfig: { thinkingBudget: 0 }, // Fast response
            }
        },
        onChunk,
        settings,
        45000 // 45 seconds timeout
    );
};

/**
 * Generates a narrative scene based on user input or conversation history.
 */
export const impersonateScene = async (
    inputText: string,
    history: Message[],
    settings?: Settings,
): Promise<string> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptDetails = await getPromptConfig(PROMPT_IDS.IMPERSONATE_SCENE, settings);

    let userPrompt: string;
    if (inputText.trim()) {
        userPrompt = `Scenario: User has provided a script.\n\nUser Script:\n---\n${inputText}\n---\nRewrite this as a narrative scene:`;
    } else {
        const conversationExcerpt = history.slice(-20).map(m => `${m.role}: ${m.content}`).join('\n\n');
        userPrompt = `Scenario: User has provided no input.\n\nConversation History:\n---\n${conversationExcerpt}\n---\nContinue the story with a new scene:`;
    }

    const response = await callGeminiWithRetry(
        {
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptDetails.template,
                temperature: 0.8,
                thinkingConfig: { thinkingBudget: 0 },
            }
        },
        settings,
        60000 // 60 seconds timeout
    );

    const result = response.text?.trim();
    if (!result) throw new Error("AI returned an empty scene.");
    return result;
};

/**
 * Removes descriptive filler from text while preserving core content and formatting.
 */
export const removeFiller = async (
    originalText: string,
    settings?: Settings,
): Promise<string> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptDetails = await getPromptConfig(PROMPT_IDS.REMOVE_FILLER, settings);

    const userPrompt = `Original Text:\n---\n${originalText}\n---\nEdited Text:`;

    const response = await callGeminiWithRetry(
        {
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptDetails.template,
                temperature: 0.2, // Low temp for precise editing
                thinkingConfig: { thinkingBudget: 0 },
            }
        },
        settings,
        45000 // 45 seconds timeout
    );
    
    const result = response.text?.trim();
    if (!result) throw new Error("AI returned empty content after editing.");
    return result;
};

/**
 * Edits a single message using a user-provided instruction. Returns the edited text.
 */
export const editMessageWithInstruction = async (
    originalText: string,
    instruction: string,
    settings?: Settings,
): Promise<string> => {
    const promptDetails = await getPromptConfig(PROMPT_IDS.EDIT_MESSAGE_WITH_INSTRUCTION, settings);

    const userPrompt = `Instruction:\n${instruction}\n\nOriginal Text:\n---\n${originalText}\n---\nEdited Text:`;

    const response = await callGeminiWithRetry(
        {
            model: promptDetails.model,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: promptDetails.template,
                temperature: 0.25,
                thinkingConfig: { thinkingBudget: 0 },
            }
        },
        settings,
        60000
    );
    const result = response.text?.trim();
    if (!result) throw new Error('AI returned empty content after editing.');
    return result;
};

// Removed batch editing helper as requested to keep code lean.

/**
 * Takes a user's natural language memory and proposes a concise fact.
 */
export const proposeIdentityFact = async (
    userInput: string,
    settings?: Settings,
): Promise<string> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptDetails = await getPromptConfig(PROMPT_IDS.PROPOSE_IDENTITY_FACT, settings);

    const schema = {
        type: Type.OBJECT,
        properties: {
            proposedFact: { type: Type.STRING, description: "The concise, reformulated fact or instruction." },
        },
        required: ["proposedFact"]
    };

    const userPrompt = `User Input: "${userInput}"`;

    try {
        const response = await callGeminiWithRetry(
            {
                model: promptDetails.model,
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: promptDetails.template,
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.3,
                    thinkingConfig: { thinkingBudget: 0 },
                }
            },
            settings,
            30000 // 30 seconds timeout
        );

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        
        if (!result.proposedFact || typeof result.proposedFact !== 'string') {
            throw new Error("AI did not return a valid proposed fact.");
        }
        return result.proposedFact;
    } catch (error: any) {
        console.error("Error proposing identity fact:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to process memory.'}`);
    }
};
