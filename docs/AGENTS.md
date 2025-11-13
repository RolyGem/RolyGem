# AI Agents Guide

RolyGem features autonomous AI agents that work in the background to enhance your storytelling experience. These agents analyze your conversation and take intelligent actions without constant manual input.

---

## Table of Contents

1. [Director AI](#director-ai)
2. [Living Lore](#living-lore)
3. [Conscious State Engine](#conscious-state-engine)
4. [Will Engine](#will-engine)
5. [Smart Mode vs Frequency Mode](#smart-mode-vs-frequency-mode)
6. [Configuration](#configuration)

---

## Director AI

**Purpose**: Inject dramatic events, plot twists, and conflicts to prevent story stagnation.

### How It Works

Director AI monitors your conversation and evaluates:
- **Stagnation**: Are characters just talking without action?
- **Drama Level**: Has the tension dropped too low?
- **Story Momentum**: Is the plot advancing or stalling?

When intervention is needed, Director AI generates an event suggestion that you can:
- **Accept**: Inject the event into the story
- **Edit**: Modify the suggestion before sending
- **Reject**: Dismiss and continue normally

### Operating Modes

#### **Smart Mode** (Recommended)
Uses Gemini 2.5 Flash Lite to analyze story context.

**How it decides to intervene**:
1. Scans the last 12 messages (configurable)
2. Evaluates dramatic need (0-100 score)
3. If score > 50: suggests intervention

**Analysis factors**:
- Recent action/conflict
- Character dynamics
- Story pacing
- Emotional tension

**Configuration**:
```
Settings → Agents → Director AI
- Mode: Smart
- Stagnation Threshold: 50 (higher = less frequent)
- Scan Depth: 12 messages
```

#### **Frequency Mode** (Traditional)
Simple interval-based system.

**How it works**:
- Triggers every N message pairs (user + model)
- Example: Frequency = 3 means every 3 exchanges

**Configuration**:
```
Settings → Agents → Director AI
- Mode: Frequency
- Frequency Value: 3 (every 3 exchanges)
```

### Event Types

Director AI can suggest:
- **Plot Twists**: Unexpected revelations
- **External Conflicts**: New threats or challenges
- **Environmental Events**: Weather, disasters, interruptions
- **Character Entrances**: NPCs arriving
- **Tension Escalation**: Raising stakes

### Manual Intervention

You can manually trigger Director AI at any time:
1. Click the **🎬** icon in the chat input
2. Director AI analyzes the current scene
3. Generates an event suggestion

---

## Living Lore

**Purpose**: Detect significant character-altering events and suggest character sheet updates.

### How It Works

Living Lore continuously monitors your conversation for events that should update a character's definition:
- Personality changes
- Physical changes (injuries, transformations)
- Relationship developments
- Major decisions or commitments
- Skill acquisition

When detected, Living Lore shows a suggestion card with:
- **Target Character**: Which character to update
- **Summary of Change**: What happened
- **Reasoning**: Why an update is needed

You can then:
- **Open in Editor**: Modify the character sheet with AI assistance
- **Dismiss**: Ignore this suggestion

### Operating Modes

#### **Smart Mode** (Recommended)
Uses AI to evaluate significance.

**How it works**:
1. Scans last 10 messages (configurable)
2. Assigns significance score (0-100)
3. If score > threshold: suggests update

**Significance scoring**:
- **90-100**: Life-changing events (death, transformation)
- **70-89**: Major developments (relationship changes, powers gained)
- **50-69**: Moderate changes (personality shifts, minor injuries)
- **0-49**: Minor or insignificant

**Configuration**:
```
Settings → Agents → Living Lore
- Mode: Smart
- Significance Threshold: 60 (lower = more sensitive)
- Scan Depth: 10 messages
```

#### **Frequency Mode**
Traditional interval checks.

**How it works**:
- Checks every N messages
- Still uses AI to detect changes, but triggered by interval

**Configuration**:
```
Settings → Agents → Living Lore
- Mode: Frequency
- Frequency Value: 5 (check every 5 messages)
```

### Multi-Character Handling

When multiple characters are active:
- Living Lore analyzes ALL characters
- Suggests the character with the most significant change
- Special case: If event affects all characters (e.g., group transformation), `targetId: 'all'` is returned

### Manual Check

Force a Living Lore scan at any time:
1. Click the **📝** icon in the chat input  
2. Living Lore analyzes recent messages
3. Shows any detected character changes

### Force Mode

When manually triggering Living Lore, it runs in "force mode":
- **Guaranteed to find something**: Won't return "no changes detected"
- **Focuses on target character**: If you select a specific character
- **Looks for ANY notable event**: Even minor developments

---

## Conscious State Engine

**Purpose**: Track character emotions, relationships, and world state in real-time.

### What It Tracks

#### **Character States**
For each active character:
- **Location**: Where they are right now
- **Emotional State**: Current mood/feelings
- **Dominant Emotions**: Top emotions with intensity (0-100)
- **Relationships**: Connection to other characters
  - Trust, affinity, forgiveness metrics
  - Tags: `ally`, `enemy`, `romantic`, etc.
- **Goals**: Active character objectives
- **Commitments**: Promises made and their status

#### **World State**
Shared environment:
- **Scene Atmosphere**: Overall mood/tone
- **External Environment**: Physical setting
- **Time of Day**: Morning, afternoon, night, etc.
- **Weather**: Current conditions
- **Scene Tension**: Conflict level (0-100)

### Engine Versions

#### **V1 (Legacy)**
Basic emotional tracking.
- Simple location + emotional_state fields
- No relationships or advanced features

#### **V2 (Current)**
Advanced emotional intelligence.
- Dominant emotions with intensity
- Relationship tracking with metrics
- Goals and commitments
- Evidence-based updates

#### **Shadow Mode**
Test new updates without affecting the story.
- Runs updates in parallel
- Shows what would change without applying
- Useful for debugging or previewing

**Configuration**:
```
Settings → Agents → Conscious State Engine
- Engine Version: V2 (recommended)
- Mode: Smart
- Update Frequency: 1 (update after every message)
```

### Operating Modes

#### **Smart Mode**
Context-aware updates only when needed.

**Triggers**:
- Significant emotional changes
- Relationship developments
- Goal progress

#### **Frequency Mode**
Regular interval updates.

**How it works**:
- Updates every N messages
- Always generates full state

### Delta Updates

To optimize performance, Conscious State uses **delta updates**:
- Only changed fields are updated
- Preserves unchanged information
- Reduces token usage

Example:
```json
{
  "character_states": [
    {
      "characterId": "char_123",
      "delta": {
        "emotional_state": "anxious → relieved",
        "mood": "tense → calm"
      }
    }
  ]
}
```

---

## Will Engine

**Purpose**: Guide character goals with intelligent intervention opportunities.

### How It Works

The Will Engine tracks **Narrative Directives** (character goals) and generates opportunities for progress:

1. **Goal Definition**: You create a directive with a goal
2. **Progress Tracking**: AI evaluates progress (0-100%)
3. **Context Analysis**: Monitors conversation for opportunities
4. **Intelligent Hints**: Generates contextual opportunities when appropriate
5. **Hunger System**: Increases pressure when goal is ignored

### Narrative Directives

Each directive defines:
- **Target Character**: Who wants to achieve this
- **Goal**: What they want (e.g., "Confess feelings to Alex")
- **Pacing**: How aggressive hints should be
  - **Slow**: Subtle, rare hints
  - **Medium**: Moderate frequency
  - **Fast**: Frequent opportunities
  - **Aggressive**: Almost every turn
- **Subtlety**: Hint style
  - **Hint**: Subtle environmental/dialogue hints
  - **Action**: Character takes initiative
  - **Confrontation**: Direct, forceful opportunities

### Smart Features

#### **Progress Tracking**
AI automatically evaluates goal completion:
- **0%**: No progress
- **50%**: Halfway there
- **100%**: Goal achieved (directive completes)

#### **Context Triggers**
Keywords that activate this directive:
- Example: For goal "Find the ancient artifact"
- Triggers: `ruins`, `temple`, `artifact`, `archaeologist`

When these words appear, Will Engine prioritizes this directive.

#### **Hunger System**
Tracks how long a directive has been ignored:
- **Hunger = 0**: Recently addressed
- **Hunger = 5**: Moderately ignored
- **Hunger = 10+**: Long ignored (increases pressure)

Higher hunger → more aggressive hints.

#### **Task Memory**
Records all AI interventions for this goal:
- Prevents repetitive hints
- Tracks what's been tried
- Ensures variety in opportunities

Example task memory:
```json
{
  "injectedAt": 1699999999,
  "intentType": "scene_opportunity",
  "intentContent": "An old map falls from a bookshelf...",
  "reasoning": "Create opportunity to find artifact clues"
}
```

### Intervention Types

#### **Scene Opportunity**
Environmental setup for goal progress.

Example:
> *An old hermit approaches, claiming to know the artifact's location.*

#### **Character Action**
Character takes initiative toward goal.

Example:
> *Sarah suddenly remembers an ancient text mentioning the ruins.*

### Configuration

Create a directive:
1. In conversation, click **⚙️ Settings**
2. **Narrative Directives** section
3. **+ Add Directive**
4. Fill in:
   - **Character**: Select from active characters
   - **Goal**: What they want to achieve
   - **Pacing**: Slow/Medium/Fast/Aggressive
   - **Subtlety**: Hint/Action/Confrontation
5. **Save**

The Will Engine will now work on this goal automatically!

---

## Smart Mode vs Frequency Mode

| Feature | Smart Mode | Frequency Mode |
|---------|-----------|----------------|
| **Trigger** | Context-aware | Fixed interval |
| **Token Usage** | Higher (AI analysis) | Lower (simple check) |
| **Accuracy** | Better timing | May miss moments |
| **Cost** | ~500 tokens per check | ~200 tokens per check |
| **Best For** | Natural storytelling | Predictable patterns |

### When to Use Smart Mode
- You want intelligent, context-aware interventions
- Story pacing is unpredictable
- You have API quota to spare

### When to Use Frequency Mode
- You want consistent, predictable behavior
- Minimizing API costs
- Story has regular rhythm

---

## Configuration Guide

### Global Settings
**Settings → Agents Tab**

Apply to all new conversations.

```yaml
Director AI:
  Enabled: true/false
  Automatic: true/false (manual only if false)
  Mode: smart/frequency
  Frequency: 3 (if frequency mode)
  Stagnation Threshold: 50 (if smart mode)
  Scan Depth: 12

Living Lore:
  Enabled: true/false
  Automatic: true/false
  Mode: smart/frequency
  Frequency: 5 (if frequency mode)
  Significance Threshold: 60 (if smart mode)
  Scan Depth: 10

Conscious State Engine:
  Enabled: true/false
  Mode: smart/frequency
  Engine Version: v1/v2/shadow
  Update Frequency: 1
  Scan Depth: 8
  Emotional Change Threshold: 50 (if smart mode)
```

### Per-Conversation Overrides
**In conversation → System Prompt editor → Smart System Config**

Override settings for this conversation only.

Example:
```json
{
  "directorAI": {
    "mode": "smart",
    "stagnationThreshold": 70
  },
  "livingLore": {
    "mode": "frequency",
    "frequencyValue": 3
  },
  "consciousState": {
    "mode": "smart",
    "engineVersion": "v2"
  }
}
```

---

## Best Practices

### For Beginners
1. Start with **Frequency Mode** for predictability
2. Enable only **Director AI** and **Living Lore** initially
3. Use moderate frequencies (3-5 messages)
4. Add **Conscious State** after you're comfortable

### For Advanced Users
1. Use **Smart Mode** for all agents
2. Lower thresholds for more frequent interventions
3. Combine **Will Engine** with custom directives
4. Use **Shadow Mode** to test Conscious State updates

### Token Management
- Smart Mode uses more tokens (AI analysis on every turn)
- If on a budget: Use Frequency Mode
- Disable agents you don't need
- Lower scan depths to reduce context size

### Debugging
Enable **Debug Mode** in Settings → Performance:
- Shows agent decision logs in console
- Displays token counts for analysis
- Helps understand why agents trigger

---

## Troubleshooting

### **Director AI not triggering**
- Check that **Automatic** is enabled
- Lower **Stagnation Threshold** (smart mode) or **Frequency** (frequency mode)
- Verify **Director AI Enabled** is checked
- Check browser console for errors

### **Living Lore never suggests updates**
- Lower **Significance Threshold** (smart mode)
- Try **Manual Check** (📝 icon) to force a scan
- Ensure events are actually significant (AI may correctly assess as minor)

### **Conscious State not updating**
- Check **Engine Version** is set to V2
- Ensure **Update Frequency** is reasonable (1-3)
- Verify characters are active in conversation
- Check console for state updates (debug mode)

### **Will Engine opportunities too frequent**
- Change **Pacing** from Fast/Aggressive to Medium/Slow
- Increase **Verification Frequency** in Smart System Config
- Remove low-priority directives

### **High token usage from agents**
- Switch to **Frequency Mode**
- Increase intervals (higher frequency numbers)
- Reduce **Scan Depth**
- Disable unused agents

---

## Advanced: Custom Prompts

All agent prompts are configurable!

**Settings → AI Prompts Tab**

You can customize:
- **Director AI Prompt**: How events are generated
- **Living Lore Prompt**: How significance is evaluated
- **Conscious State Prompt**: How emotions are tracked
- **Will Engine Prompt**: How opportunities are created

Each prompt template uses variables:
- `{{conversationExcerpt}}`: Recent messages
- `{{characterInfo}}`: Character descriptions
- `{{currentState}}`: Current conscious state

---

**Next**: [Image Generation Guide](IMAGE-GENERATION.md) →
