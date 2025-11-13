import type { Settings, ProactiveAgentService, NewsArticle, WeatherData, QuoteData, PrayerTimesData, AdhkarData } from '../types';

// --- GNews Fetcher ---
async function fetchGNews(params: any, apiKey: string): Promise<NewsArticle[]> {
  const { query = 'Artificial Intelligence', max = 3, lang = 'ar' } = params;
  if (!apiKey) {
    throw new Error("GNews API key is missing. Please add it in Settings > Proactive Agent.");
  }
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&max=${max}&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    let errorMessage = 'Unknown GNews error';
    if (errorData) {
        if (Array.isArray(errorData.errors)) {
            errorMessage = errorData.errors.join(', ');
        } else if (typeof errorData.errors === 'string') {
            errorMessage = errorData.errors;
        } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
        } else {
            try {
                errorMessage = JSON.stringify(errorData);
            } catch (e) { /* ignore */ }
        }
    }
    throw new Error(`GNews API error: ${errorMessage}`);
  }
  const data = await response.json();
  return data.articles;
}

// --- OpenWeatherMap Fetcher ---
async function fetchOpenWeatherMap(params: any, apiKey: string): Promise<WeatherData> {
  const { city = 'Baghdad', units = 'metric' } = params;
  if (!apiKey) {
    throw new Error("OpenWeatherMap API key is missing. Please add it in Settings > Proactive Agent.");
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenWeatherMap API error: ${errorData.message}`);
  }
  const data = await response.json();
  return {
    city: data.name,
    temperature: Math.round(data.main.temp),
    description: data.weather[0]?.description || 'N/A',
    icon: data.weather[0]?.icon || '',
  };
}

// --- Aladhan Prayer Times API Fetcher ---
/**
 * Fetches prayer times using the Aladhan API (https://aladhan.com/prayer-times-api)
 * This is a reliable, free API that provides accurate Islamic prayer times.
 * 
 * @param params - Must include: city, country, method (optional)
 * @returns PrayerTimesData with all prayer times for today
 */
async function fetchPrayerTimes(params: any): Promise<PrayerTimesData> {
  const { city = 'Baghdad', country = 'Iraq', method = 15 } = params;
  // Method 15 = Kuwait (suitable for Gulf region)
  // Method 3 = Muslim World League (widely used)
  // Method 2 = Islamic Society of North America
  // Full list: https://aladhan.com/calculation-methods
  
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Aladhan API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.code !== 200 || !data.data) {
    throw new Error('Aladhan API returned invalid data.');
  }
  
  const timings = data.data.timings;
  const date = data.data.date;
  
  return {
    date: `${date.readable} (${date.hijri.day} ${date.hijri.month.en} ${date.hijri.year} AH)`,
    timings: {
      Fajr: timings.Fajr,
      Sunrise: timings.Sunrise,
      Dhuhr: timings.Dhuhr,
      Asr: timings.Asr,
      Maghrib: timings.Maghrib,
      Isha: timings.Isha,
    },
    location: {
      city: data.data.meta.timezone,
      country: country,
    },
    method: data.data.meta.method.name,
  };
}

// --- Quotable API Fetcher with Multiple Free Sources ---
/**
 * Fetches random inspirational quotes with fallback support from multiple free APIs.
 * Tries multiple sources to ensure reliability, especially in regions where some APIs may be blocked.
 * All sources are 100% free and require no authentication.
 */
async function fetchQuotable(params: any): Promise<QuoteData> {
  // List of free quote APIs to try in order
  const quoteSources = [
    {
      name: 'ZenQuotes',
      url: 'https://zenquotes.io/api/random',
      parse: (data: any) => ({
        content: data[0]?.q || data[0]?.quote || '',
        author: data[0]?.a || data[0]?.author || 'Unknown',
      })
    },
    {
      name: 'Quotable',
      url: 'https://api.quotable.io/random',
      parse: (data: any) => ({
        content: data.content || '',
        author: data.author || 'Unknown',
      })
    },
    {
      name: 'API Ninjas (Free Tier)',
      url: 'https://api.api-ninjas.com/v1/quotes?category=inspirational',
      headers: { 'X-Api-Key': 'DEMO' }, // Some APIs allow demo access
      parse: (data: any) => ({
        content: data[0]?.quote || '',
        author: data[0]?.author || 'Unknown',
      })
    },
  ];

  let lastError: Error | null = null;

  // Try each source in order until one succeeds
  for (const source of quoteSources) {
    try {
      const response = await fetch(source.url, {
        headers: source.headers || {},
      });

      if (!response.ok) {
        console.warn(`[Quotable] ${source.name} failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const quote = source.parse(data);

      // Validate that we got actual content
      if (quote.content && quote.content.length > 10) {
        console.log(`[Quotable] Successfully fetched from ${source.name}`);
        return quote;
      }
    } catch (error: any) {
      console.warn(`[Quotable] ${source.name} error:`, error.message);
      lastError = error;
    }
  }

  // If all sources failed, return a curated fallback quote
  console.warn('[Quotable] All APIs failed, using fallback quote');
  return getFallbackQuote();
}

/**
 * Returns a curated inspirational quote when all APIs fail.
 * This ensures the feature never completely breaks.
 */
function getFallbackQuote(): QuoteData {
  const fallbackQuotes: QuoteData[] = [
    {
      content: 'The only way to do great work is to love what you do.',
      author: 'Steve Jobs',
    },
    {
      content: 'Innovation distinguishes between a leader and a follower.',
      author: 'Steve Jobs',
    },
    {
      content: 'The future belongs to those who believe in the beauty of their dreams.',
      author: 'Eleanor Roosevelt',
    },
    {
      content: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
      author: 'Winston Churchill',
    },
    {
      content: 'Believe you can and you\'re halfway there.',
      author: 'Theodore Roosevelt',
    },
    {
      content: 'The only impossible journey is the one you never begin.',
      author: 'Tony Robbins',
    },
    {
      content: 'Life is 10% what happens to you and 90% how you react to it.',
      author: 'Charles R. Swindoll',
    },
    {
      content: 'The best time to plant a tree was 20 years ago. The second best time is now.',
      author: 'Chinese Proverb',
    },
  ];

  // Return a random quote from the fallback list
  const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
  return fallbackQuotes[randomIndex];
}

// --- Islamic Adhkar Fetcher ---
/**
 * Fetches daily Islamic remembrances (adhkar) from a curated list.
 * This provides rotating adhkar for daily reminders.
 */
async function fetchAdhkar(params: any): Promise<AdhkarData> {
  const { category = 'morning' } = params; // morning, evening, general
  
  // Curated adhkar list (can be expanded or moved to a database)
  const adhkarDatabase: Record<string, AdhkarData[]> = {
    morning: [
      {
        title: 'Morning Remembrance',
        content: 'We have entered this morning and the domain belongs to God alone. All praise is for Him, there is no deity except Him, without partner. His is the kingdom and all praise, and He is capable of everything.',
        category: 'morning',
        repetitions: 1,
      },
      {
        title: 'Master Supplication of Forgiveness',
        content: 'O Allah, You are my Lord; there is no deity but You. You created me and I am Your servant. I uphold Your promise as best I can. I seek refuge in You from the evil I have done. I acknowledge Your blessings upon me and confess my sins. So forgive me, for none forgives sins except You.',
        category: 'morning',
        repetitions: 1,
      },
      {
        title: 'Verse of the Throne',
        content: 'Allah—there is no deity except Him, the Ever-Living, the Sustainer. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and whatever is on the earth. Who can intercede except by His permission? He knows what is before them and what is behind them, and they encompass nothing of His knowledge except what He wills. His Throne extends over the heavens and the earth, and preserving them does not tire Him. He is the Most High, the Most Great.',
        category: 'morning',
        repetitions: 1,
      },
    ],
    evening: [
      {
        title: 'Evening Remembrance',
        content: 'We have entered this evening and the domain belongs to God alone. All praise is for Him, there is no deity except Him, without partner. His is the kingdom and all praise, and He is capable of everything.',
        category: 'evening',
        repetitions: 1,
      },
      {
        title: 'Protective Verses',
        content: 'Say: I seek refuge with the Lord of daybreak from the evil of what He created, from the evil of darkness when it settles, from the evil of those who blow on knots, and from the evil of an envier when he envies.',
        category: 'evening',
        repetitions: 3,
      },
    ],
    general: [
      {
        title: 'Seeking Forgiveness',
        content: 'I seek forgiveness from Allah and turn to Him in repentance.',
        category: 'general',
        repetitions: 100,
      },
      {
        title: 'Peace Upon the Prophet',
        content: 'O Allah, bless Muhammad and the family of Muhammad as You blessed Abraham and the family of Abraham. You are indeed Praiseworthy, Glorious.',
        category: 'general',
        repetitions: 10,
      },
    ],
  };
  
  const adhkarList = adhkarDatabase[category] || adhkarDatabase.general;
  // Return a random adhkar from the selected category
  const randomIndex = Math.floor(Math.random() * adhkarList.length);
  return adhkarList[randomIndex];
}


// --- Main Service Router ---
export async function fetchData(
  service: ProactiveAgentService,
  params: Record<string, any>,
  settings: Settings
): Promise<any> {
  switch (service) {
    case 'gnews':
      return fetchGNews(params, settings.proactiveAgent.apiKeys.gnews);
    case 'openweathermap':
      return fetchOpenWeatherMap(params, settings.proactiveAgent.apiKeys.openweathermap);
    case 'quotable':
      return fetchQuotable(params);
    case 'prayer':
      return fetchPrayerTimes(params);
    case 'adhkar':
      return fetchAdhkar(params);
    default:
      throw new Error(`Unknown proactive agent service: ${service}`);
  }
}
