import type { ProactiveAgentJob } from '../../../types';

export interface ProactiveAgentJobTemplate {
  name: string;
  description: string;
  job: Omit<ProactiveAgentJob, 'id' | 'lastRun' | 'name'>;
}

export const JOB_TEMPLATES: ProactiveAgentJobTemplate[] = [
  {
    name: "Daily Wisdom",
    description: "Get an inspiring quote every morning at 7 AM.",
    job: {
      enabled: true,
      schedule: '0 7 * * *',
      service: 'quotable',
      params: {},
      synthesisPrompt: `
Good morning! Prepare "Quote of the Day" in a beautiful format.

Display the following quote:
- Write "Quote of the Day:"
- Put the quote itself in bold.
- Below it, mention the author's name.

Then, add a short paragraph (two or three lines) explaining how I, as a [software developer and writer], can apply this wisdom in my day. Keep the tone inspiring and motivating.`,
    }
  },
  {
    name: "AI News Digest",
    description: "Daily summary of the most important AI news, delivered at 8 AM.",
    job: {
      enabled: true,
      schedule: '0 8 * * *',
      service: 'gnews',
      params: { query: '"Artificial Intelligence" OR "Machine Learning" OR "OpenAI" OR "Gemini"', lang: 'en', max: 5 },
      synthesisPrompt: `
Hello. As an AI strategy expert, analyze the following news.

Choose only the top 3 news items. For each:
1. Write an engaging headline.
2. Summarize the news in two lines, focusing on "Why is this news important?" and what are its potential implications.
3. Add the source link at the end.

Keep the tone professional and concise, aimed at someone who wants to stay constantly informed in this field.`,
    }
  },
  {
    name: "Movie & Series Recommendations",
    description: "Get ready for the weekend with new recommendations every Thursday.",
    job: {
      enabled: true,
      schedule: '0 18 * * 4', // Every Thursday at 6 PM
      service: 'gnews',
      params: { query: '"new movies" OR "new series" OR "Netflix recommendation" OR "what to watch"', lang: 'en', max: 5 },
      synthesisPrompt: `
Hello, film enthusiast! The weekend is just around the corner.

From the following news, pick two outstanding recommendations (movie or series). For each:
- Mention its name with the year of production.
- Write a very brief synopsis (no spoilers!).
- Explain in one line why I might enjoy this work (remember I love sci-fi and mystery).
- Add the article link for more details.

Keep the tone enthusiastic and engaging.`,
    }
  },
  {
    name: "Morning Weather Report",
    description: "Daily weather forecast and clothing advice. (Remember to change the city!)",
    job: {
      enabled: true,
      schedule: '30 6 * * *', // Every day at 6:30 AM
      service: 'openweathermap',
      params: { city: 'Baghdad' },
      synthesisPrompt: `
Good morning! Turn this weather data into a personal and friendly morning report.

The report should include:
1. Morning greeting.
2. City name and current temperature.
3. Weather condition description in simple words (e.g., "It's sunny with some clouds").
4. Quick clothing advice based on the weather (e.g., "It's warm, light clothes will be perfect today").`,
    }
  },
  {
    name: "Top World Events",
    description: "Daily summary of major global events.",
    job: {
      enabled: true,
      schedule: '0 8 * * *',
      service: 'gnews',
      params: { query: '"world news" OR "international relations" OR "global event"', lang: 'en', max: 5 },
      synthesisPrompt: `
World News Digest.

Analyze the following news articles and select the top 3 global events. For each event:
- Write a clear and direct headline.
- Provide a neutral and objective summary of 3-4 lines explaining what happened, who the parties involved are, and what the potential consequences are.
- Mention the source with the link.`,
    }
  },
  {
    name: "Latest Tech News",
    description: "Stay up to date with the latest developments in technology.",
    job: {
      enabled: true,
      schedule: '0 19 * * *', // Daily at 7 PM
      service: 'gnews',
      params: { query: 'technology OR gadgets OR innovation OR "tech news"', lang: 'en', max: 5 },
      synthesisPrompt: `
Evening Technology Digest.

Please review the following articles and select the top 3 tech news. For each:
- Put the news headline.
- Write a brief summary explaining the new innovation or event and its significance to the average user or industry.
- Add the source link.`,
    }
  }
];