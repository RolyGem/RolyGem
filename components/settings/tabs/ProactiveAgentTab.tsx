import React, { useState, useEffect } from 'react';
import type { Settings, ProactiveAgentJob, ProactiveAgentService } from '../../../types';
import { CheckboxInput, TextInput, NumberInput } from '../common/SettingsInputComponents';
import { CollapsibleNotice } from '../../common/CollapsibleNotice';
import { generateUUID } from '../../../utils/uuid';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { ClockIcon } from '../../icons/ClockIcon';
import { useNotifications } from '../../../contexts/NotificationContext';
import { JOB_TEMPLATES, type ProactiveAgentJobTemplate } from './proactiveAgentTemplates';

interface ProactiveAgentTabProps {
  settings: Settings;
  onLiveUpdate: (newSettings: Settings) => void;
}

const EMPTY_JOB: Omit<ProactiveAgentJob, 'id' | 'lastRun'> = {
  name: '',
  enabled: true,
  schedule: '0 9 * * *', // Daily at 9am
  service: 'gnews',
  params: {},
  synthesisPrompt: '',
};

const JobEditor: React.FC<{ job: ProactiveAgentJob; onSave: (job: ProactiveAgentJob) => void; onDelete: (id: string) => void; onCancel: () => void; }> = ({ job, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState(job);
  const [scheduleMode, setScheduleMode] = useState<'simple' | 'advanced'>('simple');
  
  // Parse cron to simple format (best effort)
  const parseCron = (cron: string) => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return { frequency: 'daily', hour: '9', minute: '0' };
    const [minute, hour, , , dayOfWeek] = parts;
    if (dayOfWeek !== '*') return { frequency: 'weekly', hour: hour === '*' ? '9' : hour, minute: minute === '*' ? '0' : minute, dayOfWeek };
    return { frequency: 'daily', hour: hour === '*' ? '9' : hour, minute: minute === '*' ? '0' : minute };
  };
  
  const [simpleSchedule, setSimpleSchedule] = useState(parseCron(job.schedule));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;
    setFormData(prev => ({ ...prev, [name]: isCheckbox ? checked : value }));
  };
  
  const handleSimpleScheduleChange = (field: string, value: string) => {
    const updated = { ...simpleSchedule, [field]: value };
    setSimpleSchedule(updated);
    // Convert to cron
    const { frequency, hour, minute, dayOfWeek } = updated;
    let cron = '';
    if (frequency === 'daily') {
      cron = `${minute} ${hour} * * *`;
    } else if (frequency === 'weekly') {
      cron = `${minute} ${hour} * * ${dayOfWeek || '1'}`;
    }
    setFormData(prev => ({ ...prev, schedule: cron }));
  };

  // FIX: Broaden the event type to include HTMLSelectElement for compatibility with dropdowns.
  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, params: { ...prev.params, [name]: value } }));
  };

  const handleSave = () => {
    onSave(formData);
  };
  
  const serviceOptions: { value: ProactiveAgentService; label: string }[] = [
      { value: 'gnews', label: 'GNews (News)' },
      { value: 'openweathermap', label: 'OpenWeatherMap (Weather)' },
      { value: 'quotable', label: 'Quotable (Inspirational Quotes) 💬' },
      { value: 'prayer', label: 'Prayer Times 🕌' },
      { value: 'adhkar', label: 'Daily Adhkar 📿' },
  ];

  return (
    <div className="p-4 border rounded-lg bg-secondary-bg space-y-4">
      <h4 className="font-semibold text-lg">{job.id.startsWith('new-') ? 'New Job' : 'Edit Job'}</h4>
      <TextInput label="Job Name" name="name" value={formData.name} onChange={handleChange} placeholder="Example: Morning News Summary" />
      <CheckboxInput label="Enabled" name="enabled" checked={formData.enabled} onChange={handleChange} />
      {formData.service !== 'prayer' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Schedule</label>
            <button
              type="button"
              onClick={() => setScheduleMode(scheduleMode === 'simple' ? 'advanced' : 'simple')}
              className="text-xs text-accent-primary hover:underline"
            >
              {scheduleMode === 'simple' ? 'Advanced' : 'Simple'}
            </button>
          </div>
          
          {scheduleMode === 'simple' ? (
            <div className="space-y-3 p-3 bg-tertiary-bg/30 rounded-lg border border-color">
              <div>
                <label className="block text-xs font-medium mb-1">Frequency</label>
                <select
                  value={simpleSchedule.frequency}
                  onChange={(e) => handleSimpleScheduleChange('frequency', e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm modal-input"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              
              {simpleSchedule.frequency === 'weekly' && (
                <div>
                  <label className="block text-xs font-medium mb-1">Day of Week</label>
                  <select
                    value={simpleSchedule.dayOfWeek || '1'}
                    onChange={(e) => handleSimpleScheduleChange('dayOfWeek', e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm modal-input"
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={simpleSchedule.hour}
                    onChange={(e) => handleSimpleScheduleChange('hour', e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm modal-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Minute (0-59)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={simpleSchedule.minute}
                    onChange={(e) => handleSimpleScheduleChange('minute', e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm modal-input"
                  />
                </div>
              </div>
              
              <div className="text-xs text-text-secondary mt-2">
                📅 Will run: {simpleSchedule.frequency === 'daily' ? 'Every day' : `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(simpleSchedule.dayOfWeek || '1')]}`} at {String(simpleSchedule.hour).padStart(2, '0')}:{String(simpleSchedule.minute).padStart(2, '0')}
              </div>
            </div>
          ) : (
            <TextInput 
              label="" 
              name="schedule" 
              value={formData.schedule} 
              onChange={handleChange} 
              helpText="Cron format: minute hour day-of-month month day-of-week. * = any." 
            />
          )}
        </div>
      )}
      {formData.service === 'prayer' && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✨ <strong>Smart automatic scheduling!</strong> No need to specify a Cron schedule. 
            The system will automatically fetch prayer times daily and send reminders at the specified time for each prayer (Fajr, Dhuhr, Asr, Maghrib, Isha).
          </p>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium mb-1">Service</label>
        <select name="service" value={formData.service} onChange={handleChange} className="w-full p-2 border rounded-lg text-sm modal-input">
            {serviceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {formData.service === 'gnews' && (
        <TextInput label="Search Query" name="query" value={formData.params.query || ''} onChange={handleParamChange} placeholder="Artificial Intelligence" />
      )}
      {formData.service === 'openweathermap' && (
        <TextInput label="City" name="city" value={formData.params.city || ''} onChange={handleParamChange} placeholder="Baghdad" />
      )}
      {formData.service === 'prayer' && (
        <>
          <TextInput 
            label="City" 
            name="city" 
            value={formData.params.city || ''} 
            onChange={handleParamChange} 
            placeholder="Baghdad" 
          />
          <TextInput 
            label="Country" 
            name="country" 
            value={formData.params.country || ''} 
            onChange={handleParamChange} 
            placeholder="Iraq" 
          />
          <div>
            <label className="block text-sm font-medium mb-1">Calculation Method</label>
            <select name="method" value={formData.params.method || '15'} onChange={handleParamChange} className="w-full p-2 border rounded-lg text-sm modal-input">
              <option value="2">ISNA (North America)</option>
              <option value="3">Muslim World League</option>
              <option value="4">Umm al-Qura (Makkah)</option>
              <option value="5">Egypt</option>
              <option value="15">Kuwait (Recommended for Gulf)</option>
              <option value="16">Qatar</option>
              <option value="99">Turkey</option>
            </select>
          </div>
          <p className="text-xs text-text-secondary p-2 bg-tertiary-bg/30 rounded-md border border-color">
            💡 <strong>Note:</strong> The system automatically fetches prayer times every day and sends a reminder at the time of each prayer. You won't need to create 5 separate jobs!
          </p>
        </>
      )}
      {formData.service === 'adhkar' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Adhkar Type</label>
            <select name="category" value={formData.params.category || 'morning'} onChange={handleParamChange} className="w-full p-2 border rounded-lg text-sm modal-input">
              <option value="morning">Morning Adhkar</option>
              <option value="evening">Evening Adhkar</option>
              <option value="general">General Adhkar</option>
            </select>
          </div>
          <p className="text-xs text-text-secondary p-2 bg-tertiary-bg/30 rounded-md border border-color">
            📿 A random adhkar from the selected category will be sent according to the specified schedule.
          </p>
        </>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Synthesis Instructions (Synthesis Prompt)</label>
        <textarea name="synthesisPrompt" value={formData.synthesisPrompt} onChange={handleChange} rows={4} className="w-full p-2 border rounded-lg text-sm modal-input" placeholder="How should the AI present this information? Example: Summarize this news for Adel in a friendly and concise style." />
      </div>

      <div className="flex justify-between items-center">
        <button onClick={() => onDelete(job.id)} className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg">Delete</button>
        <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm font-medium rounded-lg btn-secondary">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm font-medium rounded-lg new-chat-btn">Save Job</button>
        </div>
      </div>
    </div>
  );
};


const ProactiveAgentTab: React.FC<ProactiveAgentTabProps> = ({ settings, onLiveUpdate }) => {
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const { addNotification } = useNotifications();

    const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        
        if (name === 'enabled') {
            onLiveUpdate({ ...settings, proactiveAgent: { ...settings.proactiveAgent, enabled: checked } });
        } else {
             const [key, field] = name.split('.');
             onLiveUpdate({
                ...settings,
                proactiveAgent: {
                    ...settings.proactiveAgent,
                    apiKeys: {
                        ...settings.proactiveAgent.apiKeys,
                        [field]: value
                    }
                }
            });
        }
    };
    
    const handleSaveJob = (job: ProactiveAgentJob) => {
        const jobs = [...settings.proactiveAgent.jobs];
        const index = jobs.findIndex(j => j.id === job.id);
        if (index > -1) {
            jobs[index] = job;
        } else {
            jobs.push(job);
        }
        onLiveUpdate({ ...settings, proactiveAgent: { ...settings.proactiveAgent, jobs } });
        setEditingJobId(null);
    };

    const handleDeleteJob = (id: string) => {
        if (!id.startsWith('new-') && !window.confirm("Are you sure you want to delete this job?")) return;
        const jobs = settings.proactiveAgent.jobs.filter(j => j.id !== id);
        onLiveUpdate({ ...settings, proactiveAgent: { ...settings.proactiveAgent, jobs } });
        setEditingJobId(null);
    };

    const handleNewJob = () => {
        setEditingJobId(`new-${generateUUID()}`);
    };
    
    const handleAddTemplate = (template: ProactiveAgentJobTemplate) => {
        const newJob: ProactiveAgentJob = {
            ...template.job,
            id: generateUUID(),
            name: template.name,
        };
        const updatedJobs = [...settings.proactiveAgent.jobs, newJob];
        onLiveUpdate({ ...settings, proactiveAgent: { ...settings.proactiveAgent, jobs: updatedJobs } });
        setEditingJobId(newJob.id); // Open editor for the new job
        addNotification({ title: 'Template Added', message: `Job "${template.name}" has been added and is ready for customization.`, type: 'success', duration: 4000 });
    };

    const editingJob = editingJobId ? (settings.proactiveAgent.jobs.find(j => j.id === editingJobId) || { ...EMPTY_JOB, id: editingJobId }) : null;

  return (
    <div className="p-6 overflow-y-auto space-y-6 flex-1">
      <h3 className="text-lg font-semibold">Proactive Agent</h3>
      <p className="text-sm text-text-secondary -mt-4">
        Allow the AI to work in the background, fetch information, and proactively initiate interactions based on a schedule.
      </p>

      {/* Experimental Feature Notice */}
      <CollapsibleNotice
        title="Experimental Feature - Under Active Development"
        variant="blue"
        icon="🧪"
        defaultExpanded={false}
      >
        <p>
          We're continuously working to deliver the best quality experience. While this feature provides automated task scheduling, 
          it's not yet a full agentic system. We're committed to building powerful AI agent capabilities into the platform in the near future, 
          including autonomous decision-making, complex workflow orchestration, and intelligent task prioritization.
        </p>
      </CollapsibleNotice>

      <div className="space-y-4 p-4 border rounded-lg border-color">
        <CheckboxInput
          label="Enable Proactive Agent"
          name="enabled"
          checked={settings.proactiveAgent.enabled}
          onChange={handleAgentInputChange}
          helpText="Main switch to enable or disable all scheduled jobs."
        />
        <div className={`space-y-4 ${!settings.proactiveAgent.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <h4 className="font-semibold pt-2">API Keys</h4>
            <TextInput label="GNews API Key" name="apiKeys.gnews" value={settings.proactiveAgent.apiKeys.gnews} onChange={handleAgentInputChange} />
            <TextInput label="OpenWeatherMap API Key" name="apiKeys.openweathermap" value={settings.proactiveAgent.apiKeys.openweathermap} onChange={handleAgentInputChange} />
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg border-color">
        <h4 className="font-semibold text-lg">Ready Templates</h4>
        <p className="text-sm text-text-secondary -mt-3">Add a pre-configured job with one click, then customize it to your needs.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {JOB_TEMPLATES.map(template => (
                <button 
                    key={template.name} 
                    onClick={() => handleAddTemplate(template)} 
                    disabled={!!editingJobId}
                    className="p-3 border rounded-lg text-left transition-colors list-item disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <p className="font-semibold text-base text-text-primary">{template.name}</p>
                    <p className="text-xs text-text-secondary mt-1">{template.description}</p>
                </button>
            ))}
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg border-color">
        <div className="flex justify-between items-center">
            <h4 className="font-semibold text-lg">Scheduled Jobs</h4>
            <button onClick={handleNewJob} disabled={!!editingJobId} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg new-chat-btn disabled:opacity-50">
                <PlusIcon className="w-4 h-4" /> New Job
            </button>
        </div>

        {editingJob && (
            <JobEditor job={editingJob} onSave={handleSaveJob} onDelete={handleDeleteJob} onCancel={() => setEditingJobId(null)} />
        )}
        
        <div className="space-y-2">
            {settings.proactiveAgent.jobs.filter(j => j.id !== editingJobId).map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary-bg/50">
                    <div>
                        <p className="font-semibold">{job.name}</p>
                        <p className="text-xs text-text-secondary flex items-center gap-1.5"><ClockIcon className="w-3 h-3" /> {job.schedule}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${job.enabled ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {job.enabled ? 'Active' : 'Paused'}
                        </span>
                        <button onClick={() => setEditingJobId(job.id)} disabled={!!editingJobId} className="text-sm text-accent-primary hover:underline disabled:opacity-50">Edit</button>
                    </div>
                </div>
            ))}
            {settings.proactiveAgent.jobs.length === 0 && !editingJob && (
                <p className="text-sm text-center text-text-secondary py-4">No scheduled jobs. Click "New Job" or choose from the ready templates to get started.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProactiveAgentTab;
