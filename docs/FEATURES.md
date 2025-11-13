# Complete Features Guide

A comprehensive guide to all RolyGem features.

---

## Table of Contents

1. [Character Management](#character-management)
2. [Conversation Features](#conversation-features)
3. [Response Controls](#response-controls)
4. [Message Actions](#message-actions)
5. [Image Generation](#image-generation)
6. [Lorebooks & World Building](#lorebooks--world-building)
7. [Context Management](#context-management)
8. [RAG & Memory](#rag--memory)
9. [Identity Profiles](#identity-profiles)
10. [Writing Styles](#writing-styles)
11. [Telegram Integration](#telegram-integration)
12. [Data Management](#data-management)
13. [PWA Features](#pwa-features)
14. [Advanced Features](#advanced-features)

---

## Character Management

### Basic Character Creation

Create characters with rich definitions:
- **Name**: Character's name
- **Description**: Personality, background, traits
- **Example Dialogue**: How they speak
- **Author Note**: Hidden AI instructions
- **Events**: Character history
- **Visual Prompt**: Appearance for image generation

### Character Arcs

Level-based character progression:
1. Enable **Story Arcs** in Settings
2. Define multiple character states at different story levels
3. As the story progresses, character definitions evolve

**Example**:
- **Level 1-5**: "Shy, inexperienced wizard student"
- **Level 6-10**: "Confident mage, learned fire magic"
- **Level 11+**: "Master wizard, leads the academy"

### Character Avatars

Upload custom character portraits:
- Supports all image formats
- Auto-converts to WebP for efficiency
- Displays next to messages in chat

### Multi-Character Conversations

Add multiple characters to a single conversation:
- Each character maintains their personality
- AI handles group dynamics automatically
- Choose between **Director Mode** (separate responses) or **Narrator Mode** (unified narration)

---

## Conversation Features

### System Prompts

Customize AI behavior per conversation:
- **Base System Prompt**: General instructions
- **Character Definitions**: Auto-injected
- **Lorebook Content**: Keyword-triggered
- **User Agency Rules**: Prevent AI from controlling your character
- **Writing Style**: Dialogue/description balance

### Multi-Character Modes

**Director Mode**:
- Each character gets separate response
- Clear character attribution
- Best for distinct personalities

**Narrator Mode**:
- Single unified narration
- Characters woven together
- More cinematic feel

### Scenario Field

Define the conversation's setting/context:
```
You are in a cyberpunk megacity in the year 2077. 
Corporations rule the world. You're a street mercenary 
taking jobs to survive.
```

Injected into system prompt for context.

### Conversation Facts

Track important canon events:
1. Add key facts during conversation
2. Facts are always injected into context
3. Categories: Event, Relationship, Secret, Decision, Custom
4. Choose injection mode: System prompt or hidden message

**Example Facts**:
- "Alex is secretly working for the enemy"
- "The ancient artifact was destroyed"
- "Sarah and John are now allies"

### Foreshadowing (Thinking Messages)

Use Gemini 2.5 Pro's extended thinking:
1. Enable **Thinking Mode** for conversation
2. Pro models generate internal reasoning first
3. Displayed as collapsed "thinking" blocks
4. Creates more dramatic, planned responses

---

## Response Controls

Per-message fine-tuning of AI behavior.

### Temperature

Controls creativity/randomness:
- **0.0**: Deterministic, focused
- **1.0**: Balanced (default)
- **2.0**: Very creative, unpredictable

Use high temp for brainstorming, low for consistency.

### Top-P (Nucleus Sampling)

Controls response diversity:
- **0.1**: Very narrow, safe choices
- **0.5**: Moderate diversity
- **1.0**: Full token range (default)

Lower values = more coherent, higher = more varied.

### Instant Instructions

One-time guidance for the next response:
- **Custom Text**: Free-form instructions
- **Presets**:
  - Tone: Serious, Playful, Dark, etc.
  - Writing Style: Poetic, Direct, Humorous
  - Focus: Action, Dialogue, Description, Emotion
  - Answer Length: Brief, Standard, Detailed
  - Style Balance: More Dialogue / More Description

**Example**:
```
Focus on body language. Be more sarcastic.
```

### Pin Controls

Keep response controls persistent:
- **Pinned**: Settings stay active for all future messages
- **Unpinned**: Resets after each message

By default, pin is **enabled** to prevent accidental loss of settings.

---

## Message Actions

Actions available on every message.

### Regenerate Response

Generate a new response:
- Keeps same context
- Different creative direction
- Quick way to get alternatives

### Edit Message

Modify message content:
- Click **Edit** icon
- Change text
- **Save** to update

Useful for:
- Fixing typos
- Redirecting story
- Adjusting character voice

### Delete Message

Remove messages:
- Single message deletion
- Recomputes context for next response
- Cannot be undone (unless you export backup)

### Copy Content

Copy message text to clipboard.

### View Full Context

See exactly what was sent to the AI:
- System prompt
- Character definitions
- Lorebook entries
- Recent messages
- RAG memories
- Facts

Useful for debugging or understanding AI behavior.

### Remove Filler

AI-powered text compression:
1. Click **Remove Filler** on model message
2. AI removes redundant phrases while preserving meaning
3. **Undo** button appears to revert

**Example**:
- **Before**: "He slowly walked across the room, step by step, moving towards the door that was on the other side."
- **After**: "He walked across the room toward the door."

### Summarize Message

Compress long messages:
1. Click **Summarize** on long message
2. AI creates concise summary
3. Toggle between **Show Original** / **Show Summary**

### Generate Image Prompt

Extract visual description from message:
1. Click **Generate Image** on message
2. AI analyzes scene and creates SD prompt
3. Sends to configured backend
4. Image appears when ready

### Generate Song

Create a song from story context:
1. Click **Generate Song** on message
2. AI analyzes recent conversation
3. Creates:
   - Song title
   - Lyrics
   - Musical style/genre
4. Displayed as **SongCard** in chat

**Suno Integration**:
- Click **Open Suno** on SongCard
- Creates song on suno.com
- Copy share link → Auto-captured in RolyGem
- Link attached to SongCard

---

## Image Generation

### Supported Backends

- **ComfyUI**: Advanced local generation
- **SD WebUI**: A1111/Forge compatibility
- **Hugging Face**: Cloud generation
- **XAI (Grok)**: Fast cloud generation

See [Image Generation Guide](IMAGE-GENERATION.md) for setup.

### Automatic Scene Generation

From any model message:
1. Click **🎨 Generate Image**
2. AI extracts scene details
3. Creates optimized prompt
4. Generates image with preferred backend
5. Result embedded in chat

### Manual Generation

Use `/sd` command:
```
/sd a dark forest at night, moonlight, mysterious atmosphere
```

### Prompt Enhancement

Auto-improve prompts with AI:
- Enable in Settings → Image Generation
- Simple prompts → Detailed, optimized prompts
- Uses Gemini to expand descriptions

### Character Visual Prompts

Define character appearance:
- Added to character definition
- Auto-included in image prompts
- Ensures character consistency

---

## Lorebooks & World Building

### Lorebook Structure

**Entries** with:
- **Keywords**: Comma-separated triggers
- **Content**: Information to inject

**Example Entry**:
```
Keywords: ancient temple, Temple of Light
Content: The Temple of Light was built 2000 years ago by 
         the Old Gods. It contains powerful artifacts but 
         is guarded by magical wards.
```

### Smart Injection

Lorebook content is injected when:
1. User or AI message contains keywords
2. Keywords are case-insensitive
3. Multiple entries can activate simultaneously

### Multiple Lorebooks

Attach multiple lorebooks to a conversation:
- World lore
- Character relationships
- Magic system
- Historical events

### RAG Integration

Lorebooks can be embedded into RAG:
- Vector search finds relevant entries
- Not limited to exact keyword matches
- Semantic similarity search

---

## Context Management

### Strategies

**Trim** (Simple):
- Keeps recent messages
- Drops oldest when limit reached

**Summarize** (Smart):
- Compresses old messages into summaries
- Preserves key information
- Saves tokens

**Hybrid** (Recommended):
- Recent messages: Full text
- Mid-term: Compressed summaries
- Archive: High-compression summaries

### Zones

1. **Recent Zone** (Protected):
   - Last ~35K tokens
   - Never summarized
   - Full conversation context

2. **Mid-Term Zone**:
   - Older messages
   - 40% compression
   - Key events preserved

3. **Archive Zone**:
   - Oldest messages
   - 20% compression
   - High-level summary

### Auto-Calibration

One-time token counting for accuracy:
- Uses Google API to count exact tokens
- Calibrates approximation
- Improves future estimates

### Summarizer Models

Choose AI for summarization:
- **Gemini** (default): Fast, accurate
- **OpenRouter**: Alternative models
- **KoboldCpp**: Local summarization

---

## RAG & Memory

**Retrieval-Augmented Generation**: Vector-based long-term memory.

### How It Works

1. **Embedding**: Messages converted to vectors
2. **Storage**: Vectors saved in HNSW index
3. **Retrieval**: Similar memories found via similarity search
4. **Injection**: Top-K memories added to context

### Embedding Engines

**KoboldCpp** (Local):
- Requires local KoboldCpp server
- Free, private
- Setup: Run KoboldCpp with embedding model

**OpenAI** (Cloud):
- Requires OpenAI API key
- Very fast
- Cost: ~$0.0001 per 1K tokens

### Configuration

```yaml
Enabled: true/false
Embedding Engine: koboldcpp / openai
KoboldCpp URL: http://localhost:5001 (if using KoboldCpp)
Top-K: 8  # Number of memories to retrieve
Chunk Size: 400  # Characters per embedding chunk
Inject Mode: user_message / system_prompt
```

### When to Use RAG

- Very long conversations (1000+ messages)
- Need to remember specific details from early conversation
- Multiple plot threads
- Complex world-building

**Note**: RAG uses additional tokens for retrieved memories.

---

## Identity Profiles

Global user persona management.

### What Are Identity Profiles?

Collections of facts about YOU (the user):
- Your character's background
- Preferences
- Skills
- Relationships

### Structure

Each profile contains multiple **facts**:
```
Fact 1: You are a detective with 10 years experience
Fact 2: You have a photographic memory
Fact 3: You're allergic to cats
```

### Usage

1. Create profile in Settings → Identity Profiles
2. Select active profile in conversation
3. Facts injected into system prompt
4. AI treats you as this character

### Add to Identity

Quick fact addition:
1. Click **Add to Identity** in chat input
2. Write fact or let AI extract from recent conversation
3. Fact added to active profile

---

## Writing Styles

Control narration/dialogue balance.

### Style Presets

**Dialogue Heavy** (80% Dialogue):
- Focus on character conversations
- Minimal scene description
- Fast-paced, screenplay-like

**Balanced** (50/50):
- Equal dialogue and description
- Novel-like narration
- Immersive and complete

**Description Heavy** (80% Description):
- Rich, detailed prose
- Minimal dialogue
- Literary, atmospheric

### Custom Style

Define your own balance:
- Set custom ratio
- Add specific instructions
- Control pacing and tone

### User Agency

**Enabled** (Recommended):
- AI never controls your character's actions, thoughts, or speech
- Your message = your character's complete turn
- AI responds AFTER your actions

**Disabled**:
- AI may move your character or speak for you
- Useful for co-writing or improv modes

---

## Telegram Integration

Access RolyGem remotely via Telegram bot.

### Setup

1. **Create Bot**:
   - Message **@BotFather** on Telegram
   - `/newbot` command
   - Get bot token

2. **Configure in RolyGem**:
   - Settings → Telegram Bot
   - Paste bot token
   - Enable bot
   - Start bot in RolyGem

3. **Start Chatting**:
   - Find your bot on Telegram
   - `/start` command
   - Link to existing conversation or create new

### Features

- Send messages from Telegram
- Receive AI responses
- Attach images
- Use commands: `/help`, `/switch`, `/new`

### Whitelist

Restrict bot access:
- Add Telegram usernames to whitelist
- Only whitelisted users can use bot
- Leave empty for public access (not recommended)

### Limitations

- No advanced features (RAG, agents, etc.)
- Basic text conversation only
- Good for mobile access on-the-go

---

## Data Management

### Export Data

Backup everything:
1. Settings → Data Management
2. **Export All Data**
3. Downloads JSON file
4. Contains:
   - All conversations
   - Characters
   - Lorebooks
   - Settings
   - Identity profiles
   - Everything!

### Import Data

Restore from backup:
1. Settings → Data Management
2. **Import Data**
3. Select JSON file
4. Choose merge or overwrite

### Selective Export/Import

Export specific items:
- **Export Conversations**: Only chats
- **Export Characters**: Only character definitions
- **Export Lorebooks**: Only world knowledge

### Clear Data

Delete specific data:
- **Clear Conversations**: Delete all chats
- **Clear Characters**: Remove characters
- **Clear Lorebooks**: Wipe knowledge bases
- **Clear All Data**: Complete reset

**Warning**: Cannot be undone! Export first!

---

## PWA Features

RolyGem works as a **Progressive Web App**.

### Install as App

**Desktop**:
1. Visit RolyGem in browser
2. Click install icon in address bar
3. Installs as standalone app

**Mobile**:
1. Open in Safari/Chrome
2. **Add to Home Screen**
3. Opens as native app

### Offline Support

- All data stored locally
- Works without internet (except AI calls)
- Service worker caches app assets

### Benefits

- Faster loading
- Desktop icon/launcher
- No browser UI
- Native feel

---

## Advanced Features

### Dual Response Mode

Compare two AI responses:
1. Enable **Dual Response** in conversation
2. Set **Alternative Model**
3. Each message generates TWO responses:
   - Primary (main model)
   - Alternative (comparison model)
4. Toggle between responses
5. Choose which to keep

**Use Cases**:
- Compare Gemini Flash vs Pro
- Test different models
- Get creative alternatives

### Message Variations

Generate multiple versions of same response:
1. Click **Generate Variations** on message
2. Choose number of variations (2-5)
3. Compare and select best

### Micro Prompt Cards

Quick one-time instruction cards:
1. Create cards with emoji + prompt
2. Activate up to 3 at once
3. Prompts injected into next response only

**Example Cards**:
- 🎭 "Be dramatically theatrical"
- 💬 "Only respond with dialogue"
- 🔍 "Focus on hidden clues"

### Briefing Room

Conversation analysis and planning:
1. Open Briefing Room for conversation
2. AI analyzes story so far
3. Provides:
   - Plot summary
   - Character states
   - Suggested directions
   - Potential plot twists

### Proactive Agent

Background agent that:
- Monitors conversation
- Suggests improvements
- Detects plot holes
- Warns of inconsistencies

Enable in Settings → Advanced.

---

## Keyboard Shortcuts

- **Ctrl+Enter**: Send message
- **Ctrl+/**: Focus input
- **Esc**: Clear input / Close modals
- **↑**: Edit last message (when input empty)

---

## Tips & Tricks

### Faster Generation

- Use **Gemini Flash** instead of Pro
- Lower **Max Context Tokens**
- Disable unused agents
- Use **Trim** context strategy

### Better Responses

- Be specific in prompts
- Use **Instant Instructions** for guidance
- Set appropriate **Temperature**
- Enable **Thinking Mode** for complex scenarios

### Token Management

- Enable **Summarization**
- Use **RAG** for very long chats
- Monitor token counts in **View Full Context**
- Periodically clear old conversations

### Character Consistency

- Use fixed **Seed** for character images
- Add detailed **Visual Prompts**
- Track character changes with **Living Lore**
- Use **Conscious State Engine** for emotional continuity

### Story Quality

- Enable **Director AI** for pacing
- Use **Will Engine** for goal-driven plots
- Add **Facts** for important canon events
- Create rich **Lorebooks** for world-building

---

**Next**: [Settings Guide](SETTINGS.md) →
