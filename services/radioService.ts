export interface RadioStation {
    changeuuid: string;
    stationuuid: string;
    name: string;
    url_resolved: string;
    homepage: string;

    favicon: string;
    country: string;
    countrycode: string;
    state: string;
    language: string;
    languagecodes: string;
    tags: string;

    codec: string;
    bitrate: number;
    clickcount: number;
    votes: number;
}

const API_BASE_URL = 'https://all.api.radio-browser.info/json';

export const searchRadioStations = async (searchTerm: string, limit: number = 50): Promise<RadioStation[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/stations/search?name=${encodeURIComponent(searchTerm)}&limit=${limit}&hidebroken=true&order=clickcount&reverse=true`);
        if (!response.ok) {
            throw new Error(`Radio API error: ${response.statusText}`);
        }
        const data: RadioStation[] = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to search for radio stations:", error);
        return []; // Return empty array on error
    }
};

export const getArabicStations = async (limit: number = 150): Promise<RadioStation[]> => {
    try {
        // List of popular Arabic-speaking countries
        const arabicCountries = [
            'egypt', 'saudi arabia', 'united arab emirates', 'iraq', 'jordan', 
            'lebanon', 'morocco', 'algeria', 'tunisia', 'kuwait', 
            'qatar', 'bahrain', 'oman', 'palestine', 'syria'
        ];
        
        let allStations: RadioStation[] = [];
        
        // Fetch stations for each country in parallel
        const fetchPromises = arabicCountries.slice(0, 8).map(async (country) => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/stations/search?country=${encodeURIComponent(country)}&limit=25&hidebroken=true&order=votes&reverse=true`
                );
                if (response.ok) {
                    return await response.json() as RadioStation[];
                }
                return [];
            } catch (err) {
                console.warn(`Failed to fetch stations from ${country}:`, err);
                return [];
            }
        });
        
        // Wait for all requests to finish
        const results = await Promise.all(fetchPromises);
        allStations = results.flat();
        
        // Fetch more stations based on Arabic language tag
        try {
            const languageResponse = await fetch(
                `${API_BASE_URL}/stations/search?language=arabic&limit=50&hidebroken=true&order=votes&reverse=true`
            );
            if (languageResponse.ok) {
                const languageStations = await languageResponse.json() as RadioStation[];
                allStations = [...allStations, ...languageStations];
            }
        } catch (err) {
            console.warn('Failed to fetch stations by language:', err);
        }
        
        // Remove duplicates by stationuuid
        const uniqueStations = Array.from(
            new Map(allStations.map(station => [station.stationuuid, station])).values()
        );
        
        // Sort by popularity (votes + clicks)
        return uniqueStations
            .filter(station => station.url_resolved) // only stations with a resolved URL
            .sort((a, b) => (b.votes + b.clickcount) - (a.votes + a.clickcount))
            .slice(0, limit);
            
    } catch (error) {
        console.error("Failed to fetch Arabic radio stations:", error);
        return [];
    }
};

// Helper to fetch stations for a specific country
export const getStationsByCountry = async (country: string, limit: number = 50): Promise<RadioStation[]> => {
    try {
        const response = await fetch(
            `${API_BASE_URL}/stations/search?country=${encodeURIComponent(country)}&limit=${limit}&hidebroken=true&order=votes&reverse=true`
        );
        if (!response.ok) {
            throw new Error(`Radio API error: ${response.statusText}`);
        }
        const data: RadioStation[] = await response.json();
        return data.filter(station => station.url_resolved);
    } catch (error) {
        console.error(`Failed to fetch stations from ${country}:`, error);
        return [];
    }
};
