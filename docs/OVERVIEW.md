# RolyGem Platform Overview

## What is RolyGem?

RolyGem is an advanced AI-powered roleplay platform built on **React 19** and **TypeScript**, designed to create immersive, dynamic storytelling experiences. Unlike traditional chatbots, RolyGem features intelligent autonomous agents that actively participate in story development, character evolution, and dramatic pacing.

---

## Core Philosophy

### 1. **Living Characters**
Characters in RolyGem are not static descriptions—they evolve, remember, and grow based on story events. The **Living Lore** system automatically detects significant moments and suggests character sheet updates.

### 2. **Autonomous Story Intelligence**
Multiple AI agents work in the background to enhance your story:
- **Director AI**: Injects dramatic events and plot twists when the story needs momentum
- **Living Lore**: Tracks character development and suggests updates
- **Conscious State Engine**: Maintains emotional continuity and character dynamics
- **Will Engine**: Guides character goals and creates organic opportunities for progress

### 3. **Privacy & Control**
- All data stored locally in **IndexedDB** (no cloud storage)
- Complete control over AI behavior and intervention frequency
- Offline-capable as a **Progressive Web App (PWA)**

---

## Technical Architecture

### Frontend Stack
- **React 19**: Modern UI with concurrent features
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first styling
- **Vite**: Fast development and optimized builds

### AI Integration
- **Google Gemini 2.5**: Primary AI models (Flash, Pro, Flash Lite)
  - **Vision support**: Image input for visual understanding
  - **Thinking mode**: Extended reasoning for complex scenarios
  - **Structured output**: Reliable JSON responses
- **OpenRouter**: Access to alternative models (Claude, GPT, etc.)
- **XAI (Grok)**: Optional integration for Grok models

### Data Management
- **IndexedDB** (via Dexie): Local database for all application data
- **HNSW** (hnswlib-wasm): Fast vector search for RAG (Retrieval-Augmented Generation)
- **Tigris Vector**: Alternative embedding storage

### Image Generation
- **ComfyUI**: Advanced workflows with custom nodes
- **SD WebUI**: Stable Diffusion with A1111/Forge
- **Hugging Face**: Cloud-based generation
- **XAI (Grok Aurora)**: Fast AI image generation

---

## Data Model

### Core Entities

#### **Conversation**
The main container for a chat session.
- **Messages**: Array of user/model/system messages
- **Characters**: Active characters in the conversation
- **Lorebooks**: Attached world-building knowledge
- **System Prompt**: Base instructions for AI behavior
- **Conscious State**: Current emotional/world state
- **Narrative Directives**: Active character goals (Will Engine)
- **Facts**: Key canon events tracked for consistency
- **Smart System Config**: Per-conversation agent settings

#### **Message**
A single message in the conversation.
- **Content**: Text content
- **Role**: `user`, `model`, or `system`
- **Metadata**: Timestamps, token counts, thinking mode
- **Attachments**: Images, suggestions, context payloads
- **Dual Response**: Alternative responses for comparison
- **Suggestion**: Director AI or Living Lore suggestions

#### **Character**
A character in your story.
- **Base Info**: Name, description, example dialogue
- **Author Note**: Hidden instructions for AI behavior
- **Character Arcs**: Level-based character progression (optional)
- **Events**: Character history and significant moments
- **Visual Prompt**: Description for image generation
- **Avatar**: Character portrait (WebP format)

#### **Lorebook**
World-building knowledge base.
- **Entries**: Keyword-triggered content blocks
- **Keywords**: Activation phrases (comma-separated)
- **Content**: Injected information when keywords match

#### **Conscious State**
Real-time tracking of character and world states.
- **Character States**: Per-character emotional tracking
  - Location, mood, dominant emotions
  - Relationships with other characters
  - Goals, commitments, evidence
- **World State**: Shared environmental context
  - Scene atmosphere, time of day, weather
  - Tension levels, salient entities

#### **Narrative Directive (Will Engine)**
A character goal with smart tracking.
- **Goal**: What the character wants to achieve
- **Target Character**: Who this goal belongs to
- **Pacing**: How aggressive the hints should be
- **Subtlety**: Hint style (subtle hint, action, confrontation)
- **Progress**: AI-evaluated completion percentage
- **Task Memory**: History of AI interventions for this goal

---

## Key Features

### 🤖 **Autonomous AI Agents**

#### Director AI
- **Purpose**: Inject dramatic events to prevent story stagnation
- **Modes**:
  - **Smart Mode**: Context-aware intervention based on story analysis
  - **Frequency Mode**: Traditional interval-based events (every N messages)
- **Intervention Types**: Plot twists, conflicts, surprises, environmental events

#### Living Lore
- **Purpose**: Track character development and suggest sheet updates
- **Modes**:
  - **Smart Mode**: AI-evaluated significance scoring (0-100)
  - **Frequency Mode**: Regular checks every N messages
- **Detection**: Personality changes, relationships, physical changes, major decisions

#### Conscious State Engine
- **Purpose**: Maintain emotional continuity and character dynamics
- **Versions**:
  - **V1**: Basic emotional state tracking
  - **V2**: Advanced with relationships, goals, commitments
  - **Shadow Mode**: Test new updates without affecting story
- **Updates**: Delta-based incremental updates for efficiency

#### Will Engine
- **Purpose**: Guide character goals with intelligent opportunities
- **Features**:
  - Progress tracking (0-100%)
  - Context-aware opportunity generation
  - Hunger system (increases pressure when ignored)
  - Task memory (prevents repetitive hints)
- **Intervention Strategies**: Hints, character actions, scene opportunities

### 💬 **Advanced Chat Features**

- **Multi-Character Support**: Seamless group conversations
- **Response Controls**: Per-message temperature, top-p, style overrides
- **Instant Instructions**: Quick one-time guidance
- **Dual Response Mode**: Compare two AI responses side-by-side
- **Message Variations**: Generate multiple versions of the same response
- **Context Management**: Automatic summarization for long conversations
- **Foreshadowing**: Gemini 2.5 Pro thinking messages for dramatic setup

### 🎨 **Image Generation**

- **Multiple Backends**: ComfyUI, SD WebUI, Hugging Face, XAI
- **Smart Prompts**: Automatic enhancement for better results
- **Scene Generation**: Background images based on context
- **Character Consistency**: Use character visual prompts
- **Face Refinement**: ADetailer support for detailed faces
- **Format Control**: Original or WebP compression

### 📚 **Knowledge Management**

- **RAG (Retrieval-Augmented Generation)**: Vector-based memory search
- **Embeddings**: KoboldCpp or OpenAI embedding engines
- **Smart Injection**: Context-aware knowledge retrieval
- **Top-K Search**: Find most relevant memories
- **Conversation Facts**: Track key canon events

### 🎵 **Additional Features**

- **Song Generation**: Create songs from story context (Suno integration)
- **Identity Profiles**: Manage multiple user personas
- **Telegram Bot**: Remote access to your RolyGem instance
- **PWA**: Install as desktop/mobile app with offline support
- **Themes**: Dark, light, or fully custom color schemes
- **Writing Styles**: Dialogue-heavy, balanced, or description-heavy
- **Export/Import**: Backup and restore all data

---

## How It Works: A Typical Session

1. **Setup**
   - Create characters with descriptions and dialogue examples
   - Add lorebooks for world-building knowledge
   - Configure AI agents (Director, Living Lore, etc.)

2. **Start Conversation**
   - Select active characters
   - Write initial message or use system prompt
   - AI responds based on character personalities

3. **Autonomous Agents Work in Background**
   - **Conscious State Engine** updates character emotions after each response
   - **Will Engine** checks goal progress and generates opportunities
   - **Living Lore** scans for significant character-altering events
   - **Director AI** evaluates story momentum and injects events when needed

4. **RAG Memory (Optional)**
   - Messages are embedded into vector database
   - Relevant past memories are retrieved for context
   - AI has access to conversation history beyond token limits

5. **Character Evolution**
   - Living Lore detects major events
   - Suggests character sheet updates
   - You approve and edit suggestions
   - Character definition evolves with story

6. **Long Conversations**
   - Context manager automatically summarizes old messages
   - Recent messages always stay intact
   - Compression preserves key information

---

## Configuration Philosophy

RolyGem offers two levels of control:

### Global Settings
- Default behavior for all conversations
- Model preferences, API keys
- Agent configurations
- Image generation backends

### Per-Conversation Overrides
- **Smart System Config**: Override agent behavior for specific chats
- **Custom System Prompts**: Unique AI instructions
- **Model Selection**: Use different models per conversation
- **Facts**: Track important story events
- **Narrative Directives**: Active character goals

---

## Performance Considerations

### Token Management
- **Context Strategies**: Trim, summarize, or hybrid
- **Recent Zone**: Last 35K tokens protected from summarization
- **Compression Levels**: Configurable for mid-term and archive zones
- **Auto-Calibration**: One-time calibration per conversation

### Memory Efficiency
- **Lazy Loading**: Components load on-demand
- **Pagination**: Conversations, characters, lorebooks load in pages
- **Indexed Storage**: Fast queries with IndexedDB indexes
- **Vector Search**: HNSW for fast similarity search

### Network Optimization
- **Streaming Responses**: Real-time token-by-token output
- **Retry Logic**: Automatic retry on failures
- **Timeout Protection**: Prevents hanging requests
- **Connection Pooling**: Reuse WebSocket connections

---

## Next Steps

- **[Features Guide](FEATURES.md)** - Detailed feature documentation
- **[Agents Guide](AGENTS.md)** - AI agent configuration
- **[Image Generation](IMAGE-GENERATION.md)** - Setup image backends
- **[Quick Start](QUICK-START.md)** - Get started in 5 minutes
- **[Settings Guide](SETTINGS.md)** - Complete settings reference

---

**Built with ❤️ for immersive AI storytelling**
