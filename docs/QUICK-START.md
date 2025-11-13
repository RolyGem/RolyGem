# Quick Start Guide

Get started with RolyGem in 5 minutes!

---

## Prerequisites

- **Node.js 18+** (recommended: 20+)
- **Gemini API Key** - [Get one free](https://aistudio.google.com/apikey)

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/RolyGem/RolyGem.git
cd RolyGem

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local

# 4. Add your Gemini API key
# Edit .env.local and add:
VITE_GEMINI_API_KEY=your_actual_key_here
```

---

## Running the App

### Development Mode
```bash
npm run dev
```
Open http://localhost:5173

### Production Mode (Recommended for PWA)
```bash
npm run prod
```
Builds and serves at http://localhost:5173

---

## First-Time Setup

### 1. Add Your API Key
1. Click **⚙️ Settings** (bottom left)
2. Go to **API Keys** tab
3. Paste your **Gemini API Key**
4. Click **Save Settings**

### 2. Create Your First Character
1. Open **Settings** → **Characters** tab
2. Click **+ Add Character**
3. Fill in:
   - **Name**: Character name (e.g., "Alex")
   - **Description**: Personality, background (e.g., "A witty detective with a dark past")
   - **Example Dialogue**: How they talk (e.g., "Listen, kid. This city eats people alive.")
   - **Author Note** (optional): Hidden instructions for AI behavior
4. Click **Save**

### 3. Start a Conversation
1. Click **+ New Conversation** (top left)
2. Select your character from the **Add Character** dropdown
3. (Optional) Write a custom **System Prompt** or use the default
4. Click **Create**
5. Start chatting!

---

## Your First Message

Try something simple:
```
Hello! Tell me about yourself.
```

The AI will respond as your character. You can:
- **Type normally** for conversational responses
- **Use quotes** for dialogue-focused messages
- **Describe actions** in asterisks: *looks around nervously*

---

## Essential Features to Try

### 1. **Response Controls** (Bottom-right of input box)
Click the **⚙️** icon to adjust:
- **Temperature**: Creativity (0.0 = focused, 2.0 = wild)
- **Top-P**: Diversity (0.1 = narrow, 1.0 = diverse)
- **Instant Instructions**: One-time guidance (e.g., "be more sarcastic")

### 2. **Message Actions** (Hover over any message)
- **🔄 Regenerate**: Get a different response
- **✏️ Edit**: Modify the message
- **📋 Copy**: Copy message text
- **🗑️ Delete**: Remove message

### 3. **Attach an Image** (📎 icon in input box)
- Upload an image for vision-capable models
- AI can describe and react to the image

### 4. **Generate an Image** (🎨 icon on model messages)
- Creates a scene image based on the message
- Requires **ComfyUI** or **SD WebUI** setup (see [Image Generation Guide](IMAGE-GENERATION.md))

---

## Enable Autonomous Agents

Want AI agents to enhance your story automatically?

### Director AI (Dramatic Events)
1. **Settings** → **Agents** tab
2. Enable **Director AI**
3. Set **Automatic** to ON
4. Choose **Frequency** (e.g., every 3 messages) or **Smart Mode**
5. **Save**

Now Director AI will inject plot twists when your story needs them!

### Living Lore (Character Evolution)
1. **Settings** → **Agents** tab
2. Enable **Living Lore**
3. Set **Automatic** to ON
4. Choose **Smart Mode** for AI-detected changes
5. **Save**

Living Lore will suggest character sheet updates after significant events!

---

## Recommended Settings for Beginners

### Model Selection
- **Gemini 2.5 Flash**: Fast, creative, great for most roleplay
- **Gemini 2.5 Pro**: More thoughtful, better for complex scenarios

### Agent Settings
- **Director AI**: Frequency 3-5 messages
- **Living Lore**: Smart Mode with threshold 60
- **Conscious State**: Disabled (enable after you're comfortable)

### Writing Style
- **Style Preference**: Balanced (good mix of dialogue and description)
- **User Agency**: Keep enabled (AI won't control your character)

---

## Common Questions

### **How do I add world-building knowledge?**
1. **Settings** → **Lorebooks** tab
2. **+ Add Lorebook**
3. Add entries with **keywords** and **content**
4. Example:
   - **Keywords**: `ancient temple, ruins`
   - **Content**: `The ancient temple was built by the Old Gods 2000 years ago...`
5. In a conversation, click **📚** to attach the lorebook

When you mention keywords in chat, the lorebook content is automatically injected!

### **How do I use multiple characters?**
1. Create multiple characters in **Settings** → **Characters**
2. In your conversation, click **Add Character** multiple times
3. The AI will handle all characters in the scene

### **Can I use without Gemini?**
Yes! Add an **OpenRouter API key** to access Claude, GPT, and other models.

### **How do I save my data?**
Everything is automatically saved to your browser's **IndexedDB**. To backup:
1. **Settings** → **Data Management** tab
2. **Export Data** → Downloads a JSON file
3. Keep this file safe!

To restore:
1. **Import Data** → Upload your JSON backup

---

## Next Steps

Now that you're set up, explore advanced features:

- **[Features Guide](FEATURES.md)** - Complete feature list
- **[Agents Guide](AGENTS.md)** - Configure AI agents
- **[Image Generation](IMAGE-GENERATION.md)** - Setup image backends
- **[Settings Guide](SETTINGS.md)** - All settings explained

---

## Troubleshooting

### **"API key invalid" error**
- Double-check your API key in Settings → API Keys
- Get a new key: https://aistudio.google.com/apikey
- Make sure there are no extra spaces

### **AI responses are slow**
- Try **Gemini 2.5 Flash** instead of Pro
- Check your internet connection
- Lower **Max Context Tokens** in Settings → Context Management

### **Messages not saving**
- Check browser console for errors (F12)
- Make sure you're not in incognito/private mode
- IndexedDB might be disabled—check browser settings

### **Image generation not working**
- You need to set up **ComfyUI** or **SD WebUI** separately
- See [Image Generation Guide](IMAGE-GENERATION.md)
- Check connection in Settings → Image Generation

---

**Need help? Open an issue on GitHub or check the docs!**
