# 🧪 RAG Retrieval Quality Test

## Test flow

### 1. Semantic similarity check
**A) Store a themed conversation**
```
User: What is the capital of France?
AI: The capital of France is Paris, a city on the Seine.

User: Tell me about today's weather.
AI: It's sunny with a temperature of 25°C.

User: What are Paris' most famous landmarks?
AI: The Eiffel Tower, the Louvre, and the Arc de Triomphe.
```

**B) Ask a related question**
```
User: Where is the Eiffel Tower located?
```

**C) Expected outcome**
- ✅ Retrieval returns the Paris/Eiffel Tower memory.
- ❌ It should not return the weather memory (irrelevant).

### 2. Test with different embedding models
- **KoboldCpp (variable dimensions)**  
  Run the collection build in the browser console, then query.
- **OpenAI Small (1536 dims)**  
  Repeat the same test.

⚠️ Important: if you build a collection with one model and query with another, you will get a dimension mismatch error.

### 3. Monitor the console
Watch for the retrieval logs and token usage:
- ✅ Good: relevant hits with reasonable token counts (< 50%).  
- ⚠️ Problem: no hits despite existing memories, or irrelevant hits.

## 🔍 Signs of accurate retrieval
1. **High relevance score** – top results directly answer the question and contain overlapping keywords.  
2. **Fresh, important memories first** – minimal duplication with the live history.  
3. **Token-aware results** – fits within the configured token budget.

## 🐛 Signs of issues
- Results only reflect the last few chat turns.  
- The collection is empty or mismatched dimensions.  
- Retrieved content feels random.

**Fix**: delete the collection and rebuild it with the same embedding model.

If results remain random:
- Model may be weak (try OpenAI large).  
- Query may be too short (add context).  
- Too few memories (< 10).

## 💡 Tips to improve quality
1. **Pick a strong embedding model**
   - ✅ OpenAI Large (3072) – highest accuracy  
   - ✅ OpenAI Small (1536) – balanced  
   - ⚠️ KoboldCpp – depends on your local model

2. **Increase Top K**
```ts
topK: 10 // instead of 8
```

3. **Reduce chunkSize for short chats**
```ts
chunkSize: 300 // instead of 400
```

4. **Watch importance scores**
Memories with importance 8–10 should surface first.

## 📈 Sample test
1. Enable RAG in Settings.  
2. Choose OpenAI Small.  
3. Chat about three distinct topics (weather, programming, cooking).  
4. Ask a programming question.  
5. Watch the console: did it only retrieve programming memories?

### Expected outcome
- ✅ All retrieved memories are about programming → **Great!**  
- ❌ Mixed with weather/cooking → **Needs tuning**
