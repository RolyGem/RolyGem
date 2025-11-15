<div align="center">

# 🎭 RolyGem

**Next-Generation AI Roleplay Platform with Dynamic Character Evolution**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB.svg)](https://react.dev/)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.5-8E75B2.svg)](https://ai.google.dev/)

[✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [📚 Documentation](#-documentation) • [🤝 Contributing](#-contributing)

---

### 🌐 Try it Live!

**Experience RolyGem without installation:** [**https://rolygem.com**](https://rolygem.com) 🚀

*Your data stays private - everything is stored locally in your browser.*

</div>

---

## 🌟 What is RolyGem?

**RolyGem** is an advanced AI-powered roleplay platform that brings characters to life through intelligent, context-aware systems. Unlike traditional chatbots, RolyGem features **autonomous AI agents** that dynamically evolve characters, inject dramatic events, and maintain emotional continuity throughout your stories.

### 🎯 Why RolyGem?

- **🧠 Living Characters**: Characters remember, evolve, and grow based on story events
- **🎬 Director AI**: Autonomous dramatic intervention system that keeps stories engaging
- **💭 Conscious State Engine**: Tracks emotional states and character dynamics in real-time
- **🤖 Multi-Model Support**: Gemini 2.5, OpenRouter (300+ models), XAI Grok,
- **🎯 Full Customization**: Control every prompt through the advanced prompt window
- **📖 Smart Lorebooks**: Context-aware knowledge injection with RAG embeddings
- **🎨 Multi-Modal**: Integrated image generation with multiple backends
- **🌐 PWA Ready**: Works offline as a Progressive Web App
- **🔒 Privacy First**: All data stored locally in IndexedDB

---

## ✨ Features

### 🤖 **Autonomous AI Systems**

#### **Director AI** - Intelligent Story Orchestration
- **Smart Mode**: Context-aware dramatic intervention
- **Frequency Mode**: Traditional interval-based events
- Automatically injects plot twists, conflicts, and dramatic moments
- Customizable intervention triggers and intensity

#### **Living Lore** - Dynamic Character Evolution
- Detects significant character development moments
- Suggests automatic character sheet updates
- Tracks personality changes, relationships, and growth
- Smart significance scoring (0-100) for event detection

#### **Conscious State Engine** - Emotional Intelligence
- Real-time emotional state tracking for all characters
- Monitors relationships, tensions, and dynamics
- Delta-based updates for efficient state management
- V2 engine with improved emotional analysis

#### **Will Engine** - Goal-Driven Narratives
- Character goal tracking and progress monitoring
- Automated opportunity generation (slip mechanics)
- Context-aware goal achievement detection
- Smart intervention strategies (hint/scene/wait)

### 💬 **Advanced Chat Features**

- **Multi-Character Support**: Seamless group conversations with multiple characters
- **Response Controls**: Per-message temperature, top-p, and style adjustments
- **Instant Instructions**: Quick modifiers for tone, style, and focus
- **Dual Response Mode**: Compare responses from different AI models
- **Message Variations**: Generate and compare multiple response options
- **Smart Context Management**: Automatic summarization for long conversations
- **Foreshadowing System**: Gemini 2.5 Pro thinking messages for dramatic setup

### 🎨 **Image Generation**

Multiple backend support:
- **ComfyUI**: Advanced workflows and custom nodes
- **Stable Diffusion WebUI**: Local generation with A1111/Forge
- **Hugging Face**: Cloud-based generation
- **XAI (Grok)**: Fast generation with Aurora model

Features:
- Automatic prompt enhancement
- Scene background generation
- Character appearance consistency
- ADetailer support for face refinement

### 📚 **Knowledge Management**

- **Smart Lorebooks**: RAG-powered context injection
- **Character Profiles**: Detailed sheets with relationships and traits
- **World Building**: Arcs, locations, and lore tracking
- **Memory Embeddings**: HNSW vector search with Tigris
- **Auto-Summarization**: Scene importance rating and extraction

### 🎵 **Additional Features**

- **Song Generation**: Context-aware music creation via Suno
- **Identity Profiles**: Manage multiple user personas
- **Telegram Bot**: Remote access to your RolyGem instance
- **Theme System**: Dark/light modes with custom colors
- **Writing Style Controls**: Narration/dialogue balance, agency settings
- **Export/Import**: Backup and restore conversations and data

---

## 🚀 Quick Start

### For Windows Users (Easiest Way) 🪟

We provide convenient batch scripts for easy setup:

**First Time Setup:**
```bash
# 1. Clone the repository
git clone https://github.com/RolyGem/RolyGem.git
cd RolyGem

# 2. Double-click install.bat (or run it from terminal)
install.bat
```

**Daily Use:**
```bash
# Double-click run.bat (or run it from terminal)
run.bat
```

The browser will open automatically at `http://localhost:5173`!

---

### Manual Installation (All Platforms)

#### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **Gemini API Key** ([Get one free](https://aistudio.google.com/apikey))

#### Installation

```bash
# Clone the repository
git clone https://github.com/RolyGem/RolyGem.git
cd RolyGem

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your Gemini API key to .env.local
VITE_GEMINI_API_KEY=your_api_key_here
```

#### Running the App

**Development Mode:**
```bash
npm run dev
# Open http://localhost:5173
```

**Production Mode (Recommended for PWA):**
```bash
npm run prod
# Builds and serves at http://localhost:5173
```

**Production Build:**
```bash
npm run build
npm start
```

### First Steps

1. **Add API Keys**: Go to Settings → API Keys and add your Gemini API key
2. **Create a Character**: Settings → Characters → Add Character
3. **Start a Conversation**: Create a new chat and select your character
4. **Enable Agents**: Settings → Agents → Enable Director AI and Living Lore

---

## 📚 Documentation

Comprehensive guides available in the `docs/` folder:

| Document | Description |
|----------|-------------|
| **[Overview](docs/OVERVIEW.md)** | Platform architecture, data model, and core concepts |
| **[Quick Start](docs/QUICK-START.md)** | Get started in 5 minutes |
| **[Features](docs/FEATURES.md)** | Complete feature list with usage examples |
| **[Agents](docs/AGENTS.md)** | AI agent systems (Director AI, Living Lore, Conscious State, Will Engine) |
| **[Image Generation](docs/IMAGE-GENERATION.md)** | Setup and configuration for image backends |
| **[Settings](docs/SETTINGS.md)** | Complete settings reference |

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS
- **AI**: Google Gemini 2.5 (Flash, Pro, Flash Lite)
- **State Management**: React Hooks, IndexedDB (Dexie)
- **Vector Search**: HNSW (hnswlib-wasm), Tigris Vector
- **Build Tool**: Vite
- **PWA**: Service Worker, Web App Manifest

---

## 🎨 Screenshots

### Chat Interface
![Chat Interface](screenshots/chat-interface.png)
*Main chat interface with character conversations and advanced features*

### Image Generation
![Image Generation](screenshots/image-generation.png)
*AI-powered image generation with multiple backend support*

---

## 💡 A Note from the Developer

**This platform is still evolving.** I published it early because I cannot solve hierarchical summarization alone — I want the open-source community to help build the first stable context engine.

I'm a student working on this project solo. RolyGem has been a one-person effort so far, and while I've implemented many features, I can't fix everything by myself. I have ideas to make the user experience even more advanced through **context engineering** and **absolute control**, but I need your help to make them reality.

### 🙏 Areas Where I Need Help

If you have experience with:
- **Hierarchical Summarization**: Multi-level context compression without losing story coherence
- **Chunk Processing**: Efficient message segmentation for long conversations
- **Long-context LLMs**: Optimizing context windows and token management
- **Context Engineering**: Smart context assembly and priority systems
- **React Performance**: Optimizing large IndexedDB datasets and virtual scrolling

...your contribution would mean **A LOT**. Even small improvements make a huge difference.

### 💬 Pro Tip for Users

Use **Instant Instructions** frequently in your conversations! It's one of the most powerful features for controlling AI behavior on-the-fly without changing global settings.

---

## 🤝 Contributing

RolyGem is **open source** under AGPL-3.0! All contributions are welcome.

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- Functional React components with hooks
- Descriptive variable names

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

**What this means:**
- ✅ You can use, modify, and distribute this software freely
- ✅ If you run a modified version on a server, you **must** share the source code
- ✅ Any modifications must also be AGPL-3.0 licensed
- ✅ Perfect for open-source AI projects and community development

---

## 🙏 Acknowledgments

- **Gemini 2.5** makes an excellent companion working behind the scenes
- **Open Source Community** for the amazing libraries and tools that power this platform
- **Contributors** who help make RolyGem better every day

> **Note**: RolyGem supports multiple AI providers (OpenRouter, XAI, and more will be added in the future). You have full control over every prompt through the customization window.

---

## 🔗 Links

- **GitHub**: [https://github.com/RolyGem/RolyGem](https://github.com/RolyGem/RolyGem)
- **Issues**: [Report bugs or request features](https://github.com/RolyGem/RolyGem/issues)
- **Discussions**: [Join the community](https://github.com/RolyGem/RolyGem/discussions)
- **Discord**: *Coming soon*

---

<div align="center">

**Made with ❤️ for the AI roleplay community**

⭐ Star us on GitHub if you find RolyGem useful!

</div>
