
export const checkKoboldConnection = async (url: string): Promise<boolean> => {
    try {
        const response = await fetch(`${url}/api/v1/model`, { method: 'GET' });
        if (!response.ok) return false;
        
        const data = await response.json();
        // Accept both active models and inactive (embedding-only) instances
        return data?.result !== undefined;
    } catch (e) {
        return false;
    }
};

export const checkKoboldEmbeddingConnection = async (url: string): Promise<{ isConnected: boolean, modelName: string }> => {
    try {
        // First check if the server is running
        const modelResponse = await fetch(`${url}/api/v1/model`, { method: 'GET' });
        if (!modelResponse.ok) return { isConnected: false, modelName: '' };
        
        const modelData = await modelResponse.json();
        const modelName = modelData?.result || 'inactive';
        
        // Test embeddings endpoint to confirm it works
        try {
            const testResponse = await fetch(`${url}/api/v1/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: ['test'] })
            });
            
            const isConnected = testResponse.ok;
            return { isConnected, modelName: isConnected ? (modelName === 'inactive' ? 'Embedding Model Active' : modelName) : '' };
        } catch {
            return { isConnected: false, modelName: '' };
        }
    } catch (e) {
        return { isConnected: false, modelName: '' };
    }
};

/**
 * Summarize text using KoboldCPP local inference
 * ✅ QUALITY FIX 7: Enhanced with adaptive max_length based on input size
 * @param text - Text to summarize
 * @param url - KoboldCPP server URL
 * @param retentionRate - Target retention rate (default 0.4 = 40%)
 * @returns Summarized text
 */
export const summarizeWithKobold = async (
    text: string, 
    url: string,
    retentionRate: number = 0.4
): Promise<string> => {
    // Calculate adaptive max_length based on input size and retention rate
    // Conservative estimate: 1 token ≈ 4 characters
    const estimatedInputTokens = Math.ceil(text.length / 4);
    const targetOutputTokens = Math.ceil(estimatedInputTokens * retentionRate);
    // Clamp between 256 and 2048 tokens for reasonable output
    const maxLength = Math.max(256, Math.min(2048, targetOutputTokens));
    
    const prompt = `[INST] Summarize the following text, preserving key events, character interactions, and important details. Target length: approximately ${Math.round(retentionRate * 100)}% of original.\n\n${text}\n[/INST]\nSummary:`;
    
    try {
        const response = await fetch(`${url}/api/v1/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                max_context_length: 8192, // Increased from 4096 for larger contexts
                max_length: maxLength,     // Adaptive based on input size
                rep_pen: 1.1,
                temperature: 0.3,          // Lower for more focused summarization (was 0.7)
                top_p: 0.9,
                top_k: 40,
                stop_sequence: ['[INST]', '\n\n[INST]'] // Additional stop sequence
            }),
        });
        
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            throw new Error(`KoboldCPP API error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.results || !data.results[0] || !data.results[0].text) {
            throw new Error('Invalid response structure from KoboldCPP');
        }
        
        const summary = data.results[0].text.trim();
        
        // ✅ QUALITY FIX 8: Validate output is not empty
        if (summary.length === 0) {
            console.warn('⚠️ KoboldCPP returned empty summary');
            throw new Error('KoboldCPP returned empty summary');
        }
        
        return summary;
    } catch (error) {
        console.error("Error summarizing with KoboldCPP:", error);
        throw error; // Re-throw to be handled by caller with fallback logic
    }
};


export const generateEmbedding = async (texts: string[], url: string): Promise<number[][]> => {
    try {
        const response = await fetch(`${url}/api/v1/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: texts }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`KoboldCPP Embedding API error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
        const data = await response.json();
        return data.data.map((r: { embedding: number[] }) => r.embedding);
    } catch (error) {
        console.error("Error generating embedding with KoboldCPP:", error);
        throw error;
    }
};
