import type { Settings, Model, Character, Conversation, Message, TelegramUpdate } from '../types';
import * as telegram from './telegramService';
import { generateUUID } from '../utils/uuid';

// Fix: Changed NodeJS.Timeout to number, as this code runs in the browser where setInterval returns a number.
let pollingInterval: number | null = null;
let lastUpdateId = 0;
let isRunning = false;
let isPolling = false; // Polling guard to prevent 409 conflict

// State for multi-step operations
const userState = new Map<number, { action: 'awaiting_system_prompt' }>();

let orchestratorConfig: {
    settings: Settings;
    models: Model[];
    characters: Character[];
    findOrCreateConversation: (chatId: number) => Promise<Conversation>;
    handleNewConversation: (chatId: number) => Promise<Conversation>;
    saveConversation: (conversation: Conversation) => Promise<any>;
    onConversationUpdate: (conversation: Conversation) => void;
    getAIResponse: (conversation: Conversation) => Promise<string>;
    handleImageGeneration: (generator: 'comfyui' | 'sdwebui', prompt: string, chatId: number) => Promise<void>;
} | null = null;


const getMainMenuKeyboard = () => ({
    inline_keyboard: [
        [{ text: '🚀 New Conversation', callback_data: 'new_conversation' }],
        [
            { text: '🤖 Select Model', callback_data: 'select_model' },
            { text: '🎭 Select Characters', callback_data: 'select_character' }
        ],
        [{ text: '📝 Edit Instructions', callback_data: 'edit_system_prompt' }],
        [{ text: 'ℹ️ Conversation Info', callback_data: 'chat_info' }],
    ]
});

const handleMessage = async (message: NonNullable<TelegramUpdate['message']>) => {
    if (!orchestratorConfig || !message.text || !message.chat.id) return;

    const chatId = message.chat.id;
    const text = message.text;
    const { settings, findOrCreateConversation, getAIResponse, onConversationUpdate, handleImageGeneration, saveConversation } = orchestratorConfig;
    
    // Handle stateful actions first
    if (userState.has(chatId)) {
        const state = userState.get(chatId);
        if (state?.action === 'awaiting_system_prompt') {
            userState.delete(chatId);
            const conversation = await findOrCreateConversation(chatId);
            const updatedConversation = { ...conversation, systemPrompt: text };
            await orchestratorConfig.saveConversation(updatedConversation);
            onConversationUpdate(updatedConversation);
            await telegram.sendMessage(settings.telegram.botToken, chatId, '✅ Instructions updated successfully!', getMainMenuKeyboard());
            return;
        }
    }

    // Handle commands
    if (text.startsWith('/')) {
        const [command, ...args] = text.substring(1).split(' ');
        const prompt = args.join(' ');

        switch (command.toLowerCase()) {
            case 'start':
                const welcomeText = `Welcome to the RolyGem bot! 👋\n\nUse the buttons below to manage everything.`;
                await telegram.sendMessage(settings.telegram.botToken, chatId, welcomeText, getMainMenuKeyboard());
                break;
            case 'new':
                await orchestratorConfig.handleNewConversation(chatId);
                await telegram.sendMessage(settings.telegram.botToken, chatId, 'Start a new conversation. What would you like to discuss?');
                break;
            case 'info':
                const conversation = await findOrCreateConversation(chatId);
                await showChatInfo(chatId, conversation);
                break;
            case 'imagine':
                if (prompt) await handleImageGeneration('comfyui', prompt, chatId);
                else await telegram.sendMessage(settings.telegram.botToken, chatId, 'Usage: /imagine <prompt>');
                break;
            case 'sd':
                if (prompt) await handleImageGeneration('sdwebui', prompt, chatId);
                else await telegram.sendMessage(settings.telegram.botToken, chatId, 'Usage: /sd <prompt>');
                break;
            default:
                await telegram.sendMessage(settings.telegram.botToken, chatId, `Unknown command: /${command}`);
        }
        return;
    }

    // Regular message handling
    await telegram.sendChatAction(settings.telegram.botToken, chatId, 'typing');
    let conversation = await findOrCreateConversation(chatId);
    
    const userMessage: Message = { id: generateUUID(), role: 'user', content: text, timestamp: Date.now() };
    const updatedConvWithUserMsg = { ...conversation, messages: [...conversation.messages, userMessage] };
    
    await saveConversation(updatedConvWithUserMsg);
    onConversationUpdate(updatedConvWithUserMsg);

    try {
        const responseText = await getAIResponse(updatedConvWithUserMsg);
        await telegram.sendMessage(settings.telegram.botToken, chatId, responseText);
    } catch (error: any) {
        await telegram.sendMessage(settings.telegram.botToken, chatId, `Sorry, an error occurred: ${error.message}`);
    }
};

const showChatInfo = async (chatId: number, conversation: Conversation) => {
    if (!orchestratorConfig) return;
    const { settings, models, characters } = orchestratorConfig;
    // Fix: Use conversation-specific model if available, otherwise fall back to the default model from settings.
    const modelId = conversation.model || settings.defaultModelId;
    const model = models.find(m => m.id === modelId) ?? models[0];
    const activeChars = characters.filter(c => conversation.characterIds?.includes(c.id));

    let infoText = `*-- Current Conversation Info --*\n\n`;
    infoText += `*🤖 Model:* \`${model.name}\`\n`;
    infoText += `*🎭 Active characters:* ${activeChars.length > 0 ? activeChars.map(c => `\`${c.name}\``).join(', ') : '_None_'}\n\n`;
    infoText += `*📝 System Prompt:*\n\`\`\`\n${conversation.systemPrompt || settings.systemPrompt}\n\`\`\``;

    await telegram.sendMessage(settings.telegram.botToken, chatId, infoText, getMainMenuKeyboard());
};

const handleCallbackQuery = async (callbackQuery: NonNullable<TelegramUpdate['callback_query']>) => {
    if (!orchestratorConfig || !callbackQuery.message || !callbackQuery.data) return;

    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const { settings, models, characters, findOrCreateConversation, saveConversation, onConversationUpdate } = orchestratorConfig;
    
    await telegram.answerCallbackQuery(settings.telegram.botToken, callbackQuery.id);
    const conversation = await findOrCreateConversation(chatId);

    if (data === 'main_menu') {
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, 'Main menu:', getMainMenuKeyboard());
    } else if (data === 'new_conversation') {
        await orchestratorConfig.handleNewConversation(chatId);
        await telegram.sendMessage(settings.telegram.botToken, chatId, 'Start a new conversation. What would you like to discuss?');
        // We can't edit the menu message if we are sending a new one, so just return
        return;
    } else if (data === 'chat_info') {
        await showChatInfo(chatId, conversation);
        return; // Message is replaced by showChatInfo
    } else if (data === 'edit_system_prompt') {
        userState.set(chatId, { action: 'awaiting_system_prompt' });
        let promptText = `*Current instructions:*\n\`\`\`\n${conversation.systemPrompt || settings.systemPrompt}\n\`\`\`\n\n`;
        promptText += 'Please send the new instructions you want to use.';
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, promptText);
    } else if (data === 'select_model') {
        const googleModels = models.filter(m => m.provider === 'Google');
        const openRouterModels = models.filter(m => m.provider === 'OpenRouter');
        
        const keyboard = [];
        if(googleModels.length > 0) {
            keyboard.push(...googleModels.map(m => ([{ text: `🇬 ${m.name}`, callback_data: `set_model_${m.id}` }])));
        }
        if(openRouterModels.length > 0) {
             keyboard.push(...openRouterModels.map(m => ([{ text: `🇴 ${m.name}`, callback_data: `set_model_${m.id}` }])));
        }
        keyboard.push([{ text: '« Back', callback_data: 'main_menu' }]);
        
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, 'Select an AI model:', { inline_keyboard: keyboard });
    } else if (data.startsWith('set_model_')) {
        const modelId = data.replace('set_model_', '');
        const updatedConversation = { ...conversation, model: modelId };
        await saveConversation(updatedConversation);
        onConversationUpdate(updatedConversation);
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, `✅ Model changed to: \`${models.find(m=>m.id === modelId)?.name}\``, getMainMenuKeyboard());
    } else if (data === 'select_character') {
        const keyboard = characters.map(c => {
            const isSelected = conversation.characterIds?.includes(c.id);
            return [{ text: `${isSelected ? '✅' : '🔲'} ${c.name}`, callback_data: `toggle_char_${c.id}` }]
        });
        keyboard.push([{ text: '« Back', callback_data: 'main_menu' }]);
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, 'Select characters (multi-select):', { inline_keyboard: keyboard });
    } else if (data.startsWith('toggle_char_')) {
        const charId = data.replace('toggle_char_', '');
        const charIds = new Set(conversation.characterIds || []);
        if (charIds.has(charId)) {
            charIds.delete(charId);
        } else {
            charIds.add(charId);
        }
        const updatedConversation = { ...conversation, characterIds: Array.from(charIds) };
        await saveConversation(updatedConversation);
        onConversationUpdate(updatedConversation);
        
        // Refresh the character selection menu
        const keyboard = characters.map(c => {
            const isSelected = updatedConversation.characterIds?.includes(c.id);
            return [{ text: `${isSelected ? '✅' : '🔲'} ${c.name}`, callback_data: `toggle_char_${c.id}` }]
        });
        keyboard.push([{ text: '« Back', callback_data: 'main_menu' }]);
        await telegram.editMessageText(settings.telegram.botToken, chatId, messageId, 'Select characters (multi-select):', { inline_keyboard: keyboard });
    }
};

const processUpdate = async (update: TelegramUpdate) => {
    const { settings } = orchestratorConfig!;
    const whitelist = settings.telegram.chatWhitelist.split(',').map(id => id.trim()).filter(Boolean);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;

    if (!chatId || (whitelist.length > 0 && !whitelist.includes(String(chatId)))) {
        console.log(`Ignoring update from non-whitelisted or unknown chat ID.`);
        return;
    }

    if (update.message) {
        await handleMessage(update.message);
    } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    }
};

const pollMessages = async () => {
    if (isPolling) return; // Prevent concurrent polls
    if (!orchestratorConfig || !orchestratorConfig.settings.telegram.botToken) return;

    isPolling = true;
    try {
        const { ok, result } = await telegram.getUpdates(orchestratorConfig.settings.telegram.botToken, lastUpdateId + 1);
        if (ok && result.length > 0) {
            for (const update of result) {
                await processUpdate(update);
                lastUpdateId = Math.max(lastUpdateId, update.update_id);
            }
        }
    } catch (error) {
        console.error("Error during Telegram polling:", error);
    } finally {
        isPolling = false;
    }
};

export const start = async (
    settings: Settings,
    models: Model[],
    characters: Character[],
    findOrCreateConversation: (chatId: number) => Promise<Conversation>,
    handleNewConversation: (chatId: number) => Promise<Conversation>,
    saveConversation: (conversation: Conversation) => Promise<any>,
    onConversationUpdate: (conversation: Conversation) => void,
    getAIResponse: (conversation: Conversation) => Promise<string>,
    handleImageGeneration: (generator: 'comfyui' | 'sdwebui', prompt: string, chatId: number) => Promise<void>
) => {
    if (isRunning) {
        stop();
    }
    
    console.log("Starting Telegram bot orchestrator...");
    
    orchestratorConfig = {
        settings, models, characters,
        findOrCreateConversation, handleNewConversation, saveConversation,
        onConversationUpdate, getAIResponse, handleImageGeneration
    };

    try {
        await telegram.setMyCommands(settings.telegram.botToken, [
            { command: 'start', description: 'Show main menu' },
            { command: 'new', description: 'Start a new conversation' },
            { command: 'info', description: 'Show conversation info' },
        ]);
    } catch(e) {
        console.warn("Could not set bot commands", e);
    }

    lastUpdateId = 0;
    
    pollMessages();
    // Fix: Use window.setInterval to ensure the browser's implementation is used, which returns a number.
    pollingInterval = window.setInterval(pollMessages, 3000);
    isRunning = true;
};

export const stop = () => {
    if (!isRunning) return; // Prevent duplicate stop messages

    if (pollingInterval) {
        // Fix: Use window.clearInterval to match the use of window.setInterval.
        window.clearInterval(pollingInterval);
        pollingInterval = null;
    }
    isRunning = false;
    isPolling = false;
    orchestratorConfig = null;
    console.log("Stopped Telegram bot orchestrator.");
};
