import type { Settings } from '../../types';
import { callGeminiWithRetry, getPromptConfig } from '../../utils/apiHelpers';
import { PROMPT_IDS } from '../../constants';

/**
 * Summarizes the content of a single message using a fast AI model.
 * The summary is designed to be a context-aware replacement for the original text.
 * @param content The original text content of the message.
 * @param settings Optional settings (will be fetched if not provided)
 * @returns A promise that resolves to the summarized text.
 */
export const summarizeMessageContent = async (content: string, settings?: Settings): Promise<string> => {
    // Get prompt configuration from user settings (AI Prompts tab)
    const promptConfig = await getPromptConfig(PROMPT_IDS.SUMMARIZE_MESSAGE, settings);

    const systemPrompt = promptConfig.template;

    const userPrompt = `Original Text:
---
${content}
---
Summary:`;
    
    try {
        const response = await callGeminiWithRetry(
            {
                model: promptConfig.model, // ✅ From AI Prompts settings
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2,
                    thinkingConfig: { thinkingBudget: 0 }, // Fast response
                }
            },
            settings,
            30000 // 30 seconds timeout
        );
        const summary = response.text;
        if (!summary) {
            throw new Error("Summarization model returned an empty response.");
        }
        return summary.trim();
    } catch (error: any) {
        console.error("Gemini message summarization error:", error);
        throw new Error(`Gemini API Error: ${error.message || 'Failed to summarize message.'}`);
    }
};
