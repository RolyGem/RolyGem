import { GoogleGenAI } from "@google/genai";
import type { Settings, IdentityProfile, AppNotification, ProactiveAgentJob, Briefing, PrayerTimesData } from '../types';
import { isJobDue } from './cronParser';
import * as apiConnector from './apiConnectorService';
import { getGeminiApiKeys } from '../utils/apiHelpers';

interface ServiceDependencies {
  getSettings: () => Settings;
  getIdentityProfiles: () => IdentityProfile[];
  saveBriefing: (briefing: { jobId: string, jobName: string, content: string }) => void;
  saveSettings: (settings: Settings) => Promise<any>;
}

let intervalId: number | null = null;
let dependencies: ServiceDependencies | null = null;
const runningJobs = new Set<string>();

// Smart Prayer Times Scheduling
// Stores today's prayer times and scheduled notifications
interface PrayerSchedule {
  date: string; // Format: YYYY-MM-DD
  timings: {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };
  notifiedPrayers: Set<string>; // Track which prayers we've already notified about
}

const prayerSchedules = new Map<string, PrayerSchedule>(); // jobId -> schedule

async function synthesizeAndAct(job: ProactiveAgentJob, data: any) {
  if (!dependencies) return;

  const settings = dependencies.getSettings();
  const identityProfiles = dependencies.getIdentityProfiles();
  const activeProfile = identityProfiles.find(p => p.id === settings.activeIdentityProfileId);
  
  const identityContent = activeProfile?.content
    ? (Array.isArray(activeProfile.content) ? activeProfile.content.map(f => f.content).join('\n') : activeProfile.content)
    : 'No identity profile set.';

  // Get API keys from settings (UI) instead of environment variables
  const keys = getGeminiApiKeys(settings);
  if (keys.length === 0) {
    console.error('[Proactive Agent] No Gemini API Key provided. Please add one in Settings.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey: keys[0] });

  const systemPrompt = `You are a proactive AI assistant. Your task is to take raw data from a service and transform it into a friendly, engaging, and personalized briefing for the user. The briefing should be detailed and well-structured in Markdown.

User's Core Identity & Instructions:
---
${identityContent}
---

User's Synthesis Prompt for this specific task:
---
${job.synthesisPrompt}
---

The output should be a well-formatted Markdown message in Arabic. It should be comprehensive, including a summary, key details, and any available sources or links. Do not add any preamble.`;

  const userPrompt = `Raw Data from ${job.service}:
---
${JSON.stringify(data, null, 2)}
---
Notification Message:`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.8,
        }
    });

    const message = response.text.trim();
    if (message) {
      dependencies.saveBriefing({
        jobId: job.id,
        jobName: job.name,
        content: message,
      });
    }
  } catch (error) {
    console.error(`[Proactive Agent] Failed to synthesize message for job '${job.name}':`, error);
  }
}

async function runJob(job: ProactiveAgentJob) {
  if (!dependencies || runningJobs.has(job.id)) return;
  console.log(`[Proactive Agent] Running job: ${job.name}`);
  runningJobs.add(job.id);

  try {
    const data = await apiConnector.fetchData(job.service, job.params, dependencies.getSettings());
    if (data) {
      await synthesizeAndAct(job, data);
    }
  } catch (error) {
    console.error(`[Proactive Agent] Failed to execute job '${job.name}':`, error);
     // Temporarily disable notifications from here
     /*
     dependencies.addNotification({
        title: `Proactive Agent Error`,
        message: `Job "${job.name}" failed: ${(error as Error).message}`,
        type: 'error',
        duration: 10000,
    });
    */
  } finally {
    runningJobs.delete(job.id);
  }
}

/**
 * Smart Prayer Time Checker
 * This function checks if it's time for a prayer notification based on dynamic prayer times.
 * It fetches prayer times daily and checks every tick if we're within the notification window.
 */
async function checkPrayerTimes(job: ProactiveAgentJob) {
  if (!dependencies) return;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let schedule = prayerSchedules.get(job.id);

  // Fetch new prayer times if we don't have today's schedule yet
  if (!schedule || schedule.date !== today) {
    try {
      console.log(`[Prayer Scheduler] Fetching prayer times for ${job.name}...`);
      const prayerData: PrayerTimesData = await apiConnector.fetchData('prayer', job.params, dependencies.getSettings());
      
      schedule = {
        date: today,
        timings: {
          Fajr: prayerData.timings.Fajr,
          Dhuhr: prayerData.timings.Dhuhr,
          Asr: prayerData.timings.Asr,
          Maghrib: prayerData.timings.Maghrib,
          Isha: prayerData.timings.Isha,
        },
        notifiedPrayers: new Set(),
      };
      
      prayerSchedules.set(job.id, schedule);
      console.log(`[Prayer Scheduler] Prayer times loaded for ${job.params.city || 'location'}:`, schedule.timings);
    } catch (error) {
      console.error(`[Prayer Scheduler] Failed to fetch prayer times:`, error);
      return;
    }
  }

  // Check each prayer time
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  for (const [prayerName, prayerTime] of Object.entries(schedule.timings)) {
    // Parse prayer time (format: "HH:MM" or "HH:MM (TIMEZONE)")
    const timeMatch = prayerTime.match(/(\d{2}):(\d{2})/);
    if (!timeMatch) continue;
    
    const [_, prayerHour, prayerMinute] = timeMatch;
    const prayerTimeStr = `${prayerHour}:${prayerMinute}`;
    
    // Check if we're within the notification window (current minute matches prayer minute)
    // and we haven't notified about this prayer yet today
    if (currentTime === prayerTimeStr && !schedule.notifiedPrayers.has(prayerName)) {
      console.log(`[Prayer Scheduler] Time for ${prayerName} prayer! Triggering notification...`);
      
      // Mark as notified
      schedule.notifiedPrayers.add(prayerName);
      
      // Create a custom data object for this specific prayer
      const prayerNotificationData = {
        prayerName,
        time: prayerTime,
        date: new Date().toLocaleDateString('ar-SA', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        location: job.params.city || 'your location',
        allTimings: schedule.timings,
      };
      
      // Trigger the notification
      await synthesizeAndAct(job, prayerNotificationData);
      return; // Exit after triggering one prayer
    }
  }
}

async function tick() {
  if (!dependencies) return;

  const settings = dependencies.getSettings();
  if (!settings.proactiveAgent.enabled || settings.proactiveAgent.jobs.length === 0) {
    return;
  }

  let jobsUpdated = false;
  const updatedJobs = settings.proactiveAgent.jobs.map(job => {
    if (!job.enabled) return job;
    
    // Special handling for prayer service - use smart scheduling
    if (job.service === 'prayer') {
      checkPrayerTimes(job); // Check dynamically without updating lastRun
      return job;
    }
    
    // Regular cron-based scheduling for other services
    if (isJobDue(job.schedule, job.lastRun)) {
      runJob(job);
      jobsUpdated = true;
      return { ...job, lastRun: Date.now() };
    }
    return job;
  });

  if (jobsUpdated) {
    const newSettings = {
        ...settings,
        proactiveAgent: {
            ...settings.proactiveAgent,
            jobs: updatedJobs,
        }
    };
    // Save settings without waiting to avoid blocking the tick loop
    dependencies.saveSettings(newSettings).catch(err => {
        console.error("[Proactive Agent] Failed to save lastRun timestamp:", err);
    });
  }
}

export function start(deps: ServiceDependencies) {
  if (intervalId) {
    stop();
  }
  dependencies = deps;
  console.log('[Proactive Agent] Starting service...');
  intervalId = window.setInterval(tick, 30 * 1000); // Check every 30 seconds
}

export function stop() {
  if (intervalId) {
    console.log('[Proactive Agent] Stopping service...');
    window.clearInterval(intervalId);
    intervalId = null;
  }
  dependencies = null;
}
