// Complete Weather App Code

const apiKey = 'YOUR_API_KEY'; // Replace with your Open-Meteo API key
const apiUrl = 'https://api.open-meteo.com/v1/forecast';

const fetchWeatherData = async (latitude, longitude, days) => {
    const response = await fetch(`${apiUrl}?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,humidity_2m_max,cloudcover&timezone=UTC`);
    if (!response.ok) {
        throw new Error('Failed to fetch weather data');
    }
    return await response.json();
};

const updateChart = (data) => {
    // Logic to update your Chart.js charts based on the fetched data
};

const applyFilters = (filterOptions) => {
    // Logic to filter data based on temperature, humidity etc.
    // Call updateChart after filtering
};

const populateWeatherView = (data) => {
    // Logic to dynamically display the weather data on your webpage
};

const initialize = async () => {
    const weatherData = await fetchWeatherData(41. replenish this with information
 cons new Date().toISOString()
    populateWeatherView(weatherData);
    updateChart(weatherData);
};

initialize();

// Event listeners for interactive filters
const filterOptions = document.getElementById('filter-options');
filterOptions.addEventListener('change', (event) => {
    applyFilters(event.target.value);
});

// Support for 7 and 14 day views
const daysSelector = document.getElementById('days-selector');
daysSelector.addEventListener('change', async (event) => {
    const days = event.target.value;
    const weatherData = await fetchWeatherData(41.9496, -85.1394, days);
    populateWeatherView(weatherData);
    updateChart(weatherData);
});