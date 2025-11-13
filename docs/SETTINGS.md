# Settings Guide

Complete reference for all RolyGem settings.

---

## Table of Contents

1. [API Keys](#api-keys)
2. [Models](#models)
3. [Characters](#characters)
4. [Lorebooks](#lorebooks)
5. [User Personas](#user-personas)
6. [Identity Profiles](#identity-profiles)
7. [Agents](#agents)
8. [Context Management](#context-management)
9. [Image Generation](#image-generation)
10. [RAG & Embeddings](#rag--embeddings)
11. [AI Prompts](#ai-prompts)
12. [Writing Style](#writing-style)
13. [Appearance](#appearance)
14. [Data Management](#data-management)
15. [Telegram Bot](#telegram-bot)
16. [Advanced](#advanced)

---

## API Keys

**Location**: Settings → API Keys

### Gemini API Key

**Required for basic functionality.**

- Get free key: https://aistudio.google.com/apikey
- Paste key and click **Test Connection**
- Used for:
  - All Gemini models (Flash, Pro, Flash Lite)
  - Agent analysis (Director AI, Living Lore, etc.)
  - Prompt enhancement
  - Summarization (if Gemini selected)

### OpenRouter API Key

**Optional** - for alternative models.

- Get key: https://openrouter.ai/keys
- Enables:
  - Claude models (Anthropic)
  - GPT models (OpenAI)
  - Llama, Mistral, and more
- Costs vary by model

### XAI API Key

**Optional** - for Grok models.

- Get key: https://console.x.ai/
- Enables:
  - Grok text models
  - Grok Aurora (image generation)
- Fast generation speeds

### OpenAI API Key

**Optional** - for embeddings.

- Get key: https://platform.openai.com/api-keys
- Used ONLY for RAG embeddings
- Alternative to KoboldCpp embeddings

---

## Models

**Location**: Settings → Models

### Model List

All available AI models displayed here:
- **Gemini Models** (if Gemini key present)
- **OpenRouter Models** (if OpenRouter key present)
- **XAI Models** (if XAI key present)

### Default Model

Select default model for new conversations:
- **Gemini 2.5 Flash**: Fast, creative (recommended)
- **Gemini 2.5 Pro**: Thoughtful, high-quality
- **Gemini 2.5 Flash Lite**: Very fast, lightweight

### Model Capabilities

Icons indicate:
- 👁️ **Vision**: Supports image input
- 🎤 **Audio**: Audio input/output
- 🧠 **Thinking**: Extended reasoning
- 🗣️ **Voice**: Voice synthesis

### Refresh Models

Click **Refresh** to fetch latest models from APIs.

---

## Characters

**Location**: Settings → Characters

### Create Character

Click **+ Add Character** and fill in:

| Field | Description | Required |
|-------|-------------|----------|
| **Name** | Character name | Yes |
| **Description** | Personality, background, traits | Yes |
| **Example Dialogue** | How they speak | Recommended |
| **Author Note** | Hidden AI instructions | Optional |
| **Events** | Character history | Optional |
| **Visual Prompt** | Appearance for images | Optional |
| **Avatar** | Character portrait image | Optional |

### Character Arcs

Enable **Story Arcs** in Settings → Story Arcs, then:
- Add multiple arcs with level ranges
- Each arc has its own description, dialogue, note
- Character evolves as story progresses

### Edit/Delete

- **Edit**: Modify character definition
- **Delete**: Remove character (cannot be undone)
- **Duplicate**: Create copy for variants

### Import/Export

- **Export**: Save character as JSON
- **Import**: Load character from JSON
- Share characters between devices or users

---

## Lorebooks

**Location**: Settings → Lorebooks

### Create Lorebook

Click **+ Add Lorebook** and fill in:

| Field | Description |
|-------|-------------|
| **Name** | Lorebook title |
| **Description** | What this lorebook covers |
| **Entries** | Keyword-triggered content blocks |

### Lorebook Entries

Each entry:
- **Keywords**: Comma-separated triggers (case-insensitive)
- **Content**: Information to inject when keywords match

**Example**:
```
Keywords: magic, spells, wizardry
Content: Magic in this world requires years of study. 
         Spells are cast through hand gestures and ancient words.
```

### Multiple Lorebooks

Create separate lorebooks for:
- World lore
- Character relationships
- Magic systems
- Historical events
- Locations

Attach relevant lorebooks to each conversation.

---

## User Personas

**Location**: Settings → User Personas

Simple user character definitions.

### Create Persona

| Field | Description |
|-------|-------------|
| **Name** | Persona name |
| **Description** | Your character's traits |

**Example**:
```
Name: Detective Morgan
Description: Experienced detective with sharp instincts. 
             Skeptical but fair. Has a dry sense of humor.
```

### Usage

Select persona in conversation → Injected into system prompt.

---

## Identity Profiles

**Location**: Settings → Identity Profiles

Advanced user identity management.

### Create Profile

1. **+ Add Identity Profile**
2. Name the profile
3. Add individual **facts**

**Example Facts**:
```
- You are a former military operative
- You have cybernetic enhancements
- You're haunted by past missions
- You trust no one easily
```

### Manage Facts

- **Add Fact**: New entry
- **Edit Fact**: Modify content
- **Delete Fact**: Remove entry

### Active Profile

Select in conversation → All facts injected into system prompt.

---

## Agents

**Location**: Settings → Agents

### Director AI

Dramatic event injection system.

```yaml
Enabled: true/false  # Master switch
Automatic: true/false  # Auto vs manual only
Mode: smart/frequency
Frequency: 3  # If frequency mode (every N message pairs)
Stagnation Threshold: 50  # If smart mode (0-100)
Scan Depth: 12  # Messages to analyze
```

**Recommendations**:
- Start with **Frequency Mode** (3-5 messages)
- Use **Smart Mode** for natural pacing
- Lower threshold = more frequent

### Living Lore

Character evolution tracking.

```yaml
Enabled: true/false
Automatic: true/false
Mode: smart/frequency
Frequency: 5  # If frequency mode
Significance Threshold: 60  # If smart mode (0-100)
Scan Depth: 10  # Messages to analyze
```

**Recommendations**:
- Use **Smart Mode** with threshold 60
- Scan depth 8-12 messages
- Enable automatic for seamless updates

### Conscious State Engine

Emotional/world state tracking.

```yaml
Enabled: true/false
Mode: smart/frequency
Engine Version: v1/v2/shadow
Update Frequency: 1  # Every N messages
Scan Depth: 8  # Messages to analyze
Emotional Change Threshold: 50  # If smart mode
```

**Recommendations**:
- Use **V2 Engine** for advanced features
- Update frequency 1-2 for real-time tracking
- **Smart Mode** for efficient updates

### Story Arcs

Level-based progression system.

```yaml
Enabled: true/false
Levels: Array of level definitions
- Min/Max Messages: Range for each level
- Description: What happens at this level
```

Tied to character arcs feature.

---

## Context Management

**Location**: Settings → Context Management

### Strategy

Choose how to handle long conversations:

**Trim**:
- Keeps recent messages
- Drops oldest
- Simple, fast

**Summarize**:
- Compresses old messages
- Preserves information
- Best for long chats

**Hybrid** (Recommended):
- Recent: Full text
- Mid-term: Light summarization
- Archive: Heavy summarization

### Configuration

```yaml
Strategy: trim/summarize/hybrid
Summarizer Model: gemini/openrouter/koboldcpp
Max Context Tokens: null (auto) or specific number
Token Counting Mode: fast/accurate
Auto-Calibrate: true/false (one-time calibration)
Recent Zone Tokens: 35000  # Protected from summarization
Compression Levels:
  Mid-Term: 0.4  # 40% retained
  Archive: 0.2   # 20% retained
Debug Mode: true/false  # Show logs
```

### Recommendations

- **Hybrid** for best results
- **Auto-Calibrate**: Enable once per conversation
- **Recent Zone**: 30K-40K tokens
- **Debug Mode**: Enable when troubleshooting

---

## Image Generation

**Location**: Settings → Image Generation

### General

```yaml
Preferred Generator: comfyui/sdwebui/huggingface/xai
Auto-Enhance Prompts: true/false  # AI prompt improvement
```

### ComfyUI

See [Image Generation Guide](IMAGE-GENERATION.md) for full details.

```yaml
URL: http://localhost:8188
Checkpoint: model.safetensors
Sampler: euler_a
Scheduler: normal
Steps: 20
CFG Scale: 7
Seed: 0  # 0 = random
Width: 832
Height: 1216
Negative Prompt: blurry, ugly, deformed
Enable Upscaler: true/false
Upscale Model: RealESRGAN_x4plus.pth
Upscale Factor: 2
Output Format: original/webp-browser
WebP Quality: 90
Loras: Array of lora configs
```

### SD WebUI

```yaml
URL: http://localhost:7860
Checkpoint: model name
Sampler: Euler a
Scheduler: Automatic
Steps: 20
CFG Scale: 7
Seed: -1  # -1 = random
Width: 832
Height: 1216
Negative Prompt: blurry, ugly, deformed
Enable Hires.fix: true/false
Hires Upscaler: Latent
Hires Steps: 10
Denoising Strength: 0.7
Upscale By: 2
Face Restoration: CodeFormer/GFPGAN/none
ADetailer Units: Array of 4 units
VAE: Automatic or specific VAE
Refiner: Optional refiner model
Output Format: original/webp-browser
Loras: Array of lora configs
```

### Hugging Face

```yaml
API Key: (from HF settings)
Model: stabilityai/stable-diffusion-xl-base-1.0
Steps: 25
Guidance Scale: 7.5
Negative Prompt: (optional)
```

---

## RAG & Embeddings

**Location**: Settings → RAG & Embeddings

### Configuration

```yaml
Enabled: true/false
Embedding Engine: koboldcpp/openai
KoboldCpp URL: http://localhost:5001  # If using KoboldCpp
Embedding Model Name: (auto-detected)
Top-K: 8  # Number of memories to retrieve
Chunk Size: 400  # Characters per chunk
Inject Mode: user_message/system_prompt
```

### When to Enable

- Conversations > 500 messages
- Need to remember early details
- Complex plots with many threads

### Recommendations

- **Top-K**: 5-10 memories
- **Chunk Size**: 300-500 characters
- **Inject Mode**: user_message (more natural)

---

## AI Prompts

**Location**: Settings → AI Prompts

Customize prompts for all AI systems.

### Available Prompts

- **Director AI**: Event generation
- **Living Lore**: Significance evaluation
- **Conscious State**: State tracking
- **Will Engine**: Opportunity generation
- **Summarization**: Context compression
- **And more...**

### Editing Prompts

1. Click prompt to expand
2. Modify **Template**
3. Change **Model** (if desired)
4. Adjust **Temperature**
5. **Save**

### Template Variables

Use placeholders:
- `{{conversationExcerpt}}`: Recent messages
- `{{characterInfo}}`: Character descriptions
- `{{currentState}}`: Current conscious state
- `{{facts}}`: Conversation facts

### Reset to Defaults

Click **Reset to Default** to restore original prompt.

---

## Writing Style

**Location**: Settings → Writing Style

### User Agency

```yaml
Enabled: true/false
Prompt: Custom user agency instructions
```

**Enabled**: AI never controls your character.
**Disabled**: AI may move/speak for you.

### Style Preference

Choose dialogue/description balance:
- **Dialogue Heavy**: 80% dialogue, 20% description
- **Balanced**: 50/50 mix
- **Description Heavy**: 80% description, 20% dialogue

### Custom Presets

Edit preset prompts for each style to fine-tune behavior.

---

## Appearance

**Location**: Settings → Appearance

### Theme

```yaml
Theme: light/dark/custom
```

**Light**: Soft, readable light theme
**Dark**: Default dark theme
**Custom**: Full color customization

### Custom Theme Colors

If theme = custom:
- Background colors
- Text colors
- Accent colors
- Border colors
- Modal colors
- Message bubble colors
- Scrollbar colors

All colors customizable with color picker.

### Typography

```yaml
Font Family: Font name (default: Inter)
Font Size: 14-24px
Line Height: 1.4-2.0
```

### Layout

```yaml
Desktop Padding: 0-30%  # Horizontal padding
Message Spacing: 0.5-2.0  # Vertical spacing multiplier
Message Bubble Style: sharp/soft/rounded
```

### Dialogue Highlighting

```yaml
Highlight Dialogue: true/false
Dialogue Color (Light): Color picker
Dialogue Color (Dark): Color picker
```

Highlights quoted dialogue in messages.

---

## Data Management

**Location**: Settings → Data Management

### Export

- **Export All Data**: Complete backup (JSON)
- **Export Conversations**: Only chats
- **Export Characters**: Only character defs
- **Export Lorebooks**: Only lorebooks

### Import

- **Import Data**: Restore from JSON backup
- Choose **Merge** or **Overwrite**

### Clear Data

**⚠️ Warning: Cannot be undone!**

- **Clear Conversations**: Delete all chats
- **Clear Characters**: Remove all characters
- **Clear Lorebooks**: Wipe all lorebooks
- **Clear All Data**: Complete reset

Always export before clearing!

---

## Telegram Bot

**Location**: Settings → Telegram Bot

### Setup

```yaml
Bot Token: (from @BotFather)
Enabled: true/false
Chat Whitelist: Comma-separated usernames
```

### Status

- **Bot Username**: Displayed when connected
- **Connection Status**: Online/Offline
- **Start Bot**: Button to enable polling

### Whitelist

Add Telegram usernames (without @):
```
username1, username2, username3
```

Leave empty for public access (not recommended).

---

## Advanced

**Location**: Settings → Advanced

### Performance

```yaml
Lazy Loading: true/false  # Load components on-demand
Pagination Size: 20-100  # Items per page
```

### Debug Mode

```yaml
Show Token Counts: true/false
Verbose Logging: true/false
Agent Decision Logs: true/false
```

### Experimental Features

```yaml
Proactive Agent: true/false  # Background analysis
Shadow Mode (Conscious State): true/false  # Test updates
```

### Storage

```yaml
IndexedDB Size: (display only)
Clear Cache: Button to clear temporary data
```

---

## Recommended Settings

### For Beginners

```yaml
Models:
  Default: Gemini 2.5 Flash

Agents:
  Director AI: Frequency mode, every 3 messages
  Living Lore: Smart mode, threshold 60
  Conscious State: Disabled

Context:
  Strategy: Trim
  Max Tokens: Auto

Image Generation:
  Generator: SD WebUI (if local) or Hugging Face
  Auto-Enhance: true

Writing Style:
  Preference: Balanced
  User Agency: Enabled
```

### For Advanced Users

```yaml
Models:
  Default: Gemini 2.5 Pro

Agents:
  Director AI: Smart mode, threshold 60
  Living Lore: Smart mode, threshold 50
  Conscious State: V2 engine, Smart mode
  Will Engine: Enabled

Context:
  Strategy: Hybrid
  Auto-Calibrate: true
  Summarizer: Gemini

RAG:
  Enabled: true (for long chats)
  Engine: KoboldCpp or OpenAI
  Top-K: 8

Image Generation:
  Generator: ComfyUI
  Loras: Multiple style loras
  Upscaler: Enabled

Writing Style:
  Custom presets with specific instructions
```

---

## Troubleshooting Settings

### "Settings not saving"
- Check browser localStorage is enabled
- Not in incognito/private mode
- Clear browser cache

### "API keys not working"
- Verify keys are correct (no spaces)
- Test connection after pasting
- Check account has credits/quota

### "Images not generating"
- Test backend connection
- Check backend is running
- Verify correct URL and port

### "Agents not triggering"
- Check **Enabled** is checked
- Verify **Automatic** is enabled
- Lower thresholds/increase frequency

### "High token usage"
- Switch agents to Frequency mode
- Increase frequency numbers (less often)
- Reduce scan depths
- Use Trim instead of Summarize

---

## Settings Backup

Settings are automatically saved to IndexedDB.

To backup manually:
1. **Export All Data** includes settings
2. Keep JSON file safe
3. **Import Data** to restore

---

**All documentation complete! Happy storytelling! 🎭**
