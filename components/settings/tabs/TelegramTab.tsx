import React, { useState } from 'react';
import type { Settings } from '../../../types';
import * as db from '../../../services/db';
import { sendMessage as sendTelegramMessage } from '../../../services/telegramService';
import { CheckboxInput, getStatusIndicator } from '../common/SettingsInputComponents';
import { LoaderIcon } from '../../icons/LoaderIcon';

interface TelegramTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  connectionStatus: 'idle' | 'loading' | 'success' | 'error';
  connectionError: string | null;
  onConnect: () => void;
  addNotification: (notification: { title: string, message: string, type?: 'info' | 'success' | 'error', duration?: number }) => void;
}

/**
 * Renders the "Telegram" tab in the settings modal.
 * This component manages settings for integrating a Telegram bot,
 * allowing users to chat with the application from their Telegram client.
 */
const TelegramTab: React.FC<TelegramTabProps> = ({
  settings,
  onLiveUpdate,
  connectionStatus,
  connectionError,
  onConnect,
  addNotification
}) => {
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleTelegramInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const isChecked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
    
    const newTelegramSettings = {
        ...settings.telegram,
        [name]: isCheckbox ? isChecked : value,
    };
    const newSettings = { ...settings, telegram: newTelegramSettings };
    onLiveUpdate(newSettings);

    if (name === 'botToken') {
        onLiveUpdate({ ...newSettings, telegram: { ...newTelegramSettings, isConnected: false, botUsername: '' } });
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !settings.telegram.isConnected) return;
    
    setIsBroadcasting(true);
    try {
        const chatIds = await db.getAllTelegramChatIds();
        if (chatIds.length === 0) {
            addNotification({ title: 'Broadcast', message: 'No users have interacted with the bot yet.', type: 'info', duration: 4000 });
            return;
        }

        let successCount = 0;
        for (const chatId of chatIds) {
            try {
                await sendTelegramMessage(settings.telegram.botToken, chatId, broadcastMessage);
                successCount++;
                await new Promise(res => setTimeout(res, 100)); // Rate limit
            } catch (e) {
                console.error(`Failed to send broadcast to ${chatId}`, e);
            }
        }
        addNotification({ title: 'Broadcast Sent', message: `Message sent to ${successCount} of ${chatIds.length} users.`, type: 'success', duration: 5000 });
        setBroadcastMessage('');

    } catch (e: any) {
        addNotification({ title: 'Broadcast Failed', message: e.message, type: 'error', duration: 5000 });
    } finally {
        setIsBroadcasting(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Telegram Bot Integration</h3>
          <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">BETA</span>
        </div>
        <p className="text-sm text-text-secondary -mt-4">
            Connect a Telegram bot to chat with your setup from anywhere. The browser tab must remain open for the bot to function.
        </p>
        <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ This feature is still under development. Some functionality may be incomplete or unstable.
          </p>
        </div>
        
        <div className="space-y-4 p-4 border rounded-lg border-color">
            <CheckboxInput
                label="Enable Telegram Bot"
                name="enabled"
                checked={settings.telegram.enabled}
                onChange={handleTelegramInputChange}
                helpText="Allows the application to poll for messages from your Telegram bot."
            />
            <div className={`space-y-4 ${!settings.telegram.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label htmlFor="botToken" className="block text-sm font-medium">Bot Token</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="password"
                            id="botToken"
                            name="botToken"
                            value={settings.telegram.botToken}
                            onChange={handleTelegramInputChange}
                            className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                            placeholder="Enter token from BotFather"
                        />
                        <button onClick={onConnect} disabled={connectionStatus === 'loading' || !settings.telegram.botToken} className="px-4 py-2 text-sm font-medium new-chat-btn rounded-lg disabled:opacity-50">
                            {connectionStatus === 'loading' ? '...' : 'Connect'}
                        </button>
                    </div>
                    <div className="h-4 mt-1">
                        {getStatusIndicator(connectionStatus, connectionError, `Connected as @${settings.telegram.botUsername}`)}
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                        Get your token by talking to <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">@BotFather</a> on Telegram.
                    </p>
                </div>
                <div>
                    <label htmlFor="chatWhitelist" className="block text-sm font-medium">Chat ID Whitelist</label>
                    <textarea
                        id="chatWhitelist"
                        name="chatWhitelist"
                        value={settings.telegram.chatWhitelist}
                        onChange={handleTelegramInputChange}
                        rows={2}
                        className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                        placeholder="e.g., 12345678, 87654321"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                        Comma-separated list of Telegram Chat IDs to respond to. Leave empty to respond to all chats. Find your ID by talking to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">@userinfobot</a>.
                    </p>
                </div>
            </div>
        </div>
         <div className="space-y-4 p-4 border rounded-lg border-color">
            <h4 className="font-semibold">Broadcast Message</h4>
            <p className="text-xs text-text-secondary">Send a message to all users who have interacted with your bot.</p>
            <textarea
                id="broadcastMessage"
                name="broadcastMessage"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 modal-input"
                placeholder="Announce updates or send a notification to all your bot users."
                disabled={!settings.telegram.isConnected || isBroadcasting}
            />
            <button
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim() || !settings.telegram.isConnected || isBroadcasting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold new-chat-btn rounded-lg transition-colors disabled:opacity-50"
            >
                {isBroadcasting ? <LoaderIcon className="w-5 h-5"/> : null}
                {isBroadcasting ? 'Sending...' : 'Send to All Users'}
            </button>
        </div>
    </div>
  );
};

export default TelegramTab;
