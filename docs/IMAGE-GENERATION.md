# Image Generation Guide

RolyGem supports multiple image generation backends, allowing you to create scene illustrations and character portraits directly within your conversations.

---

## Supported Backends

| Backend | Type | Best For | Setup Difficulty |
|---------|------|----------|------------------|
| **ComfyUI** | Local | Advanced workflows, custom nodes | Medium |
| **SD WebUI** | Local | A1111/Forge compatibility, ADetailer | Easy |
| **Hugging Face** | Cloud | No local setup, quick testing | Easy |
| **XAI (Grok)** | Cloud | Fast generation, Aurora model | Easy |

---

## ComfyUI

**Best for**: Advanced users who want full control over generation workflows.

### Features
- Custom node support
- Lora integration with automatic trigger phrases
- Upscaling with RealESRGAN
- Multiple samplers and schedulers
- Seed control for reproducibility
- WebP compression to save storage

### Setup

1. **Install ComfyUI**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   pip install -r requirements.txt
   ```

2. **Start ComfyUI**
   ```bash
   python main.py --listen 0.0.0.0 --port 8188
   ```

3. **In RolyGem**:
   - **Settings** → **Image Generation** → **ComfyUI** tab
   - Set **URL**: `http://localhost:8188`
   - Click **Test Connection**
   - Select your preferred **Checkpoint** (model)
   - Configure generation settings

### Configuration

```yaml
URL: http://localhost:8188
Checkpoint: v1-5-pruned-emaonly.ckpt  # Your SD model
Sampler: euler  # euler_a, dpmpp_2m, etc.
Scheduler: normal  # normal, karras, exponential
Steps: 20  # 15-30 recommended
CFG Scale: 7  # 5-10 for most styles
Seed: 0  # 0 = random
Resolution: 832x1216  # Portrait
Negative Prompt: blurry, ugly, deformed, low quality
```

### Loras

Add Lora models for style control:

1. Place `.safetensors` files in `ComfyUI/models/loras/`
2. In RolyGem:
   - **Settings** → **Image Generation** → **ComfyUI** → **Loras**
   - **+ Add Lora**
   - Select lora name
   - Set strength (0.0-2.0, typically 0.6-0.8)
   - Add trigger phrases if needed
   - Enable "Include trigger in prompt" (optional)

### Upscaling

Enable for higher resolution output:

1. Download upscale model (e.g., `RealESRGAN_x4plus.pth`)
2. Place in `ComfyUI/models/upscale_models/`
3. In RolyGem:
   - Enable **Upscaler**
   - Select model
   - Set **Upscale Factor** (2x or 4x)

---

## Stable Diffusion WebUI (A1111/Forge)

**Best for**: Users familiar with Automatic1111 or Forge interfaces.

### Features
- Hires.fix for quality upscaling
- Face restoration (CodeFormer, GFPGAN)
- ADetailer for face refinement (4 units)
- VAE support
- Refiner models
- Lora support
- WebP compression

### Setup

#### For Automatic1111:
```bash
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
# Follow installation instructions for your OS
./webui.sh --api --listen
```

#### For Forge:
```bash
git clone https://github.com/lllyasviel/stable-diffusion-webui-forge.git
cd stable-diffusion-webui-forge
# Follow installation instructions
./webui.sh --api --listen
```

### In RolyGem

- **Settings** → **Image Generation** → **Stable Diffusion WebUI**
- Set **URL**: `http://localhost:7860`
- Click **Test Connection**
- Configure settings

### Configuration

```yaml
URL: http://localhost:7860
Checkpoint: Your model name
Sampler: Euler a  # DPM++ 2M Karras, etc.
Scheduler: Automatic  # Karras, Exponential
Steps: 20
CFG Scale: 7
Seed: -1  # -1 = random
Resolution: 832x1216
Negative Prompt: blurry, ugly, deformed, worst quality
```

### Hires.fix

Upscale images during generation for better quality:

```yaml
Enable Hires.fix: true
Upscaler: Latent  # R-ESRGAN 4x+, SwinIR, etc.
Upscale By: 2  # 1.5x or 2x
Hires Steps: 10  # Additional denoising steps
Denoising Strength: 0.7  # 0.4-0.8 range
```

### Face Restoration

Improve face details:
- **Face Restoration**: CodeFormer or GFPGAN
- Applied after generation

### ADetailer

**Advanced face/object refinement** (requires extension):

1. **Install ADetailer Extension**:
   - In SD WebUI: Extensions → Install from URL
   - URL: `https://github.com/Bing-su/adetailer.git`
   - Click Install → Apply and restart

2. **Configure in RolyGem**:
   - **Settings** → **Image Generation** → **SD WebUI** → **ADetailer Units**
   - Enable up to 4 units
   - Each unit:
     ```yaml
     Enabled: true
     Model: face_yolov8n.pt  # Detection model
     Prompt: detailed face, sharp eyes
     Negative Prompt: blurry face, deformed
     Confidence: 0.3  # Detection threshold
     ```

ADetailer automatically detects faces/objects and refines them with separate generation passes.

---

## Hugging Face

**Best for**: Quick testing without local setup.

### Features
- Cloud-based (no local installation)
- Access to Hugging Face model hub
- Simple configuration

### Setup

1. **Get API Token**:
   - Visit: https://huggingface.co/settings/tokens
   - Create a **Read** token
   - Copy the token

2. **In RolyGem**:
   - **Settings** → **Image Generation** → **Hugging Face**
   - Paste **API Key**
   - Click **Test Connection**

### Configuration

```yaml
Model: stabilityai/stable-diffusion-xl-base-1.0
Steps: 25
Guidance Scale: 7.5
Negative Prompt: (optional)
```

### Limitations
- Slower than local generation
- API rate limits
- Fewer customization options
- Requires internet connection

---

## XAI (Grok Aurora)

**Best for**: Fast, high-quality generation with minimal setup.

### Features
- **Aurora model**: XAI's image generation model
- Very fast generation
- Cloud-based (no local setup)
- High-quality results

### Setup

1. **Get XAI API Key**:
   - Visit: https://console.x.ai/
   - Create account and get API key

2. **In RolyGem**:
   - **Settings** → **API Keys** → **XAI API Key**
   - Paste your key
   - **Save Settings**

3. **Set as Preferred**:
   - **Settings** → **Image Generation** → **General**
   - **Preferred Generator**: XAI

### Usage

- Works like other backends
- No advanced options (Aurora has built-in quality)
- Fast generation (~5-10 seconds)

---

## How to Generate Images

### From Messages

1. **Hover over any model message**
2. Click **🎨 Generate Image**
3. RolyGem extracts scene context
4. Creates prompt automatically
5. Sends to your preferred backend
6. Image appears in chat when ready

### Manual Generation

Use the `/sd` command in chat:

```
/sd a mysterious forest at twilight, glowing mushrooms, fantasy art
```

RolyGem will:
1. Enhance the prompt (if Auto-Enhancement enabled)
2. Generate with preferred backend
3. Display result in chat

### Character Portraits

Add **Visual Prompt** to characters:
- **Settings** → **Characters** → Edit character
- **Visual Prompt**: Describe appearance
  ```
  young woman, long black hair, blue eyes, 
  leather jacket, confident expression
  ```

When generating images in conversations with this character, the visual prompt is automatically included.

---

## Prompt Enhancement

RolyGem can automatically improve your prompts using AI.

### How It Works

1. You provide simple prompt: `forest scene`
2. AI expands it to:
   ```
   dense enchanted forest, morning mist, sunbeams through trees, 
   moss-covered stones, fantasy atmosphere, detailed foliage, 
   vibrant colors, high quality, masterpiece
   ```
3. Enhanced prompt is sent to generator

### Enable

**Settings** → **Image Generation** → **General**
- **Auto-Enhance Prompts**: ON
- Uses Gemini to expand prompts

---

## Output Formats

### Original Format
- Saves images as generated (PNG usually)
- Best quality, larger file size

### WebP Compression
- Converts to WebP format
- Reduces file size by 60-80%
- Minimal quality loss
- Recommended for storage efficiency

**Enable**:
```
Settings → Image Generation → [Backend] → Output Format
- Select: webp-browser
- Quality: 90 (recommended)
```

---

## Troubleshooting

### **ComfyUI**

#### "Connection failed"
- Ensure ComfyUI is running
- Check URL: `http://localhost:8188`
- Verify firewall isn't blocking
- Try `http://127.0.0.1:8188`

#### "Checkpoint not found"
- Place `.safetensors` models in `ComfyUI/models/checkpoints/`
- Refresh models in RolyGem settings
- Check spelling matches exactly

#### "Lora not loading"
- Place loras in `ComfyUI/models/loras/`
- Set strength between 0.5-1.0
- Ensure lora is compatible with checkpoint

### **SD WebUI**

#### "API endpoint not found"
- Start with `--api` flag
- Example: `./webui.sh --api --listen`
- Check SD WebUI is fully loaded

#### "ADetailer not working"
- Install extension from GitHub
- Restart SD WebUI after install
- Check extension is enabled in Extensions tab
- Verify detection model is downloaded

#### "Face restoration not applied"
- Select face restorer (CodeFormer or GFPGAN)
- Models auto-download on first use
- Check SD WebUI console for errors

### **Hugging Face**

#### "Invalid API token"
- Get new token: https://huggingface.co/settings/tokens
- Must be **Read** token (not Write)
- Check for extra spaces when pasting

#### "Generation taking too long"
- Hugging Face queues requests
- Try during off-peak hours
- Consider local generation for speed

### **XAI**

#### "API key invalid"
- Verify key from https://console.x.ai/
- Check account has generation credits
- Ensure key has image generation permissions

---

## Best Practices

### Prompts

**Good**:
```
medieval tavern interior, warm candlelight, wooden tables, 
stone walls, cozy atmosphere, detailed, high quality
```

**Bad**:
```
tavern
```

**Tips**:
- Be specific about details
- Include lighting, mood, style
- Use quality tags: `detailed`, `high quality`, `masterpiece`
- Avoid contradictions

### Negative Prompts

Always include:
```
blurry, ugly, deformed, low quality, worst quality, 
bad anatomy, watermark, signature
```

For characters:
```
bad hands, extra fingers, missing fingers, 
bad proportions, disfigured face
```

### Resolution

| Aspect Ratio | Resolution | Best For |
|--------------|------------|----------|
| Portrait | 832x1216 | Characters, vertical scenes |
| Landscape | 1216x832 | Environments, wide shots |
| Square | 1024x1024 | General purpose |

### Performance

- **Steps**: 20-25 is sweet spot (more ≠ always better)
- **CFG**: 7-10 for most styles (higher = more literal)
- **Seed**: 0 for variety, fixed for consistency
- **Batch**: Generate one at a time in chat to avoid memory issues

---

## Advanced Tips

### Style Consistency

Use fixed seeds + same loras for consistent style across images.

### Scene Backgrounds

Generate wide landscape shots for scene backgrounds:
- Resolution: 1216x832
- Prompt: Environment focus, no characters
- Use as reference for character scenes

### Character Consistency

1. Create character with detailed visual prompt
2. Generate portrait
3. Note seed number
4. Reuse seed for future character images

### Workflows

For advanced users (ComfyUI):
- Create custom workflows in ComfyUI
- RolyGem uses default workflow
- Modify `comfyuiService.ts` for custom workflows

---

**Next**: [Settings Guide](SETTINGS.md) →
