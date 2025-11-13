import type { GetMeResponse, TelegramUpdate, InlineKeyboardMarkup } from '../types';

const apiRequest = async <T>(token: string, method: string, body?: object): Promise<T> => {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    try {
        const response = await fetch(url, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined,
        });
        return response.json();
    } catch (error: any) {
        console.error(`Telegram API request failed for method ${method}:`, error);
        return {
            ok: false,
            description: error.message || 'A network error occurred.',
            error_code: 500,
        } as any;
    }
};

export const verifyToken = async (token: string): Promise<GetMeResponse> => {
    return apiRequest<GetMeResponse>(token, 'getMe');
};

export const sendMessage = async (token: string, chatId: number, text: string, reply_markup?: InlineKeyboardMarkup): Promise<any> => {
    return apiRequest(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup,
    });
};

export const editMessageText = async (token: string, chatId: number, messageId: number, text: string, reply_markup?: InlineKeyboardMarkup): Promise<any> => {
    return apiRequest(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup,
    });
};

export const answerCallbackQuery = async (token: string, callbackQueryId: string, text?: string): Promise<any> => {
    return apiRequest(token, 'answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text,
    });
};

export const setMyCommands = async (token: string, commands: { command: string; description: string }[]): Promise<any> => {
    return apiRequest(token, 'setMyCommands', { commands });
};


export const sendChatAction = async (token: string, chatId: number, action: string): Promise<any> => {
    return apiRequest(token, 'sendChatAction', {
        chat_id: chatId,
        action,
    });
};

export const sendPhoto = async (token: string, chatId: number, photoUrl: string, caption: string): Promise<any> => {
    return apiRequest(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'Markdown',
    });
};

export const getUpdates = async (
    token: string,
    offset: number,
    timeout: number = 30,
): Promise<{ ok: boolean, result: TelegramUpdate[] }> => {
    const response = await apiRequest<{ ok: boolean, result?: TelegramUpdate[], description?: string, error_code?: number }>(token, 'getUpdates', {
        offset,
        timeout,
        allowed_updates: ['message', 'callback_query'],
    });

    if (response.error_code === 409) {
        console.warn('Telegram API conflict: Another getUpdates request is running. Stopping this polling cycle.');
        // Return an empty result to prevent processing and let the orchestrator handle the pause.
        return { ok: true, result: [] };
    }
    
    if (response.ok && response.result) {
        return { ok: true, result: response.result };
    }
    
    return { ok: false, result: [] };
};