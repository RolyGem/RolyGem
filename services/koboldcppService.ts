
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

export const summarizeWithKobold = async (text: string, url: string): Promise<string> => {
    const prompt = `[INST] Summarize the key events from the following text:\n${text}\n[/INST]\nSummary:`;
    try {
        const response = await fetch(`${url}/api/v1/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                max_context_length: 4096,
                max_length: 512,
                rep_pen: 1.1,
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                stop_sequence: ['[INST]']
            }),
        });
        if (!response.ok) {
            throw new Error(`KoboldCPP API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results[0].text.trim();
    } catch (error) {
        console.error("Error summarizing with KoboldCPP:", error);
        throw error;
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
