import React from 'react';
import type { Settings, Model } from '../../../types';

interface DualResponseTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
  models: Model[];
}

const DualResponseTab: React.FC<DualResponseTabProps> = ({ settings, onLiveUpdate, models }) => {
  const handleToggle = (field: string, value: boolean) => {
    onLiveUpdate({
      ...settings,
      dualResponse: {
        ...settings.dualResponse,
        [field]: value
      }
    });
  };

  const handleModeChange = (mode: 'same_model' | 'different_models') => {
    onLiveUpdate({
      ...settings,
      dualResponse: {
        ...settings.dualResponse,
        mode
      }
    });
  };

  const handleModelChange = (field: 'primaryModel' | 'alternativeModel', value: string) => {
    onLiveUpdate({
      ...settings,
      dualResponse: {
        ...settings.dualResponse,
        [field]: value
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-color">
        <h3 className="text-xl font-bold text-text-primary">Dual Response Sync</h3>
        <p className="text-sm text-text-secondary mt-2">
          Get two synchronized responses at the same time and compare them to choose the best one
        </p>
      </div>

      {/* Enable/Disable */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-tertiary-bg/30 rounded-lg border border-color">
          <div>
            <label className="block text-sm font-medium text-text-primary">
              Enable Dual Response Sync
            </label>
            <p className="text-xs text-text-secondary mt-1">
              When enabled, two synchronized responses will be generated for each message you send
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.dualResponse.enabled}
              onChange={(e) => handleToggle('enabled', e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent-primary dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
          </label>
        </div>

        {/* Mode Selection */}
        {settings.dualResponse.enabled && (
          <div className="space-y-4">
            <div className="p-4 bg-tertiary-bg/30 rounded-lg border border-color">
              <label className="block text-sm font-medium text-text-primary mb-3">
                Sync Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 bg-secondary-bg rounded-lg border border-color cursor-pointer hover:bg-tertiary-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="dualResponseMode"
                    value="same_model"
                    checked={settings.dualResponse.mode === 'same_model'}
                    onChange={() => handleModeChange('same_model')}
                    className="mr-3 text-accent-primary focus:ring-accent-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">Same Model Twice</div>
                    <div className="text-xs text-text-secondary">Use the same model to generate two different responses</div>
                  </div>
                </label>
                <label className="flex items-center p-3 bg-secondary-bg rounded-lg border border-color cursor-pointer hover:bg-tertiary-bg/50 transition-colors">
                  <input
                    type="radio"
                    name="dualResponseMode"
                    value="different_models"
                    checked={settings.dualResponse.mode === 'different_models'}
                    onChange={() => handleModeChange('different_models')}
                    className="mr-3 text-accent-primary focus:ring-accent-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">Different Models</div>
                    <div className="text-xs text-text-secondary">Compare responses from two different models</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Model Selection - Only for different_models mode */}
            {settings.dualResponse.mode === 'different_models' && (
              <div className="p-4 bg-tertiary-bg/30 rounded-lg border border-color space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Primary Model (Response A)
                  </label>
                  <select
                    value={settings.dualResponse.primaryModel || settings.defaultModelId}
                    onChange={(e) => handleModelChange('primaryModel', e.target.value)}
                    className="w-full p-3 rounded-lg border-2 border-color modal-input text-sm"
                  >
                    <option value="">Use default model</option>
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary mt-1">
                    The model to use for the primary response
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Alternative Model (Response B)
                  </label>
                  <select
                    value={settings.dualResponse.alternativeModel || settings.defaultModelId}
                    onChange={(e) => handleModelChange('alternativeModel', e.target.value)}
                    className="w-full p-3 rounded-lg border-2 border-color modal-input text-sm"
                  >
                    <option value="">Use default model</option>
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary mt-1">
                    The model to use for the alternative response
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="text-blue-500 mt-0.5">ℹ️</div>
                <div className="flex-1 text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">How does it work?</p>
                  <ul className="list-disc list-inside space-y-1 text-xs opacity-90">
                    <li>The request is sent to two models at the same time</li>
                    <li>You see both responses streaming live in real-time</li>
                    <li>Switch between responses freely to compare them</li>
                    <li>Click "Confirm" to save your chosen response to RAG</li>
                    <li>The other response remains available for reference</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DualResponseTab;
