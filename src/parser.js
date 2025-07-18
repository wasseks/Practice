/**
 * Parses JSON data and extracts sensor values.
 * @param {Object} jsonData - The JSON data to parse.
 * @returns {Object} - Object containing devices and processed data.
 */
export function parseData(jsonData) {
  console.log('Parser: Starting data parsing.'); // Log start of parsing

  if (!jsonData || typeof jsonData !== 'object') {
    console.error('Error: Invalid JSON data provided. Returning empty data.');
    return { devices: [], data: [] };
  }

  const deviceNames = new Set();
  const processedData = [];

  for (const entry of Object.values(jsonData)) {
    // Ensure essential fields exist and 'data' is an object
    if (entry.uName && entry.Date && entry.data) {
      // Add unique device name
      deviceNames.add(entry.uName);

      // Store the processed entry for later use
      processedData.push({
        uName: entry.uName,
        Date: entry.Date, 
        data: entry.data
      });
    } else {
      console.warn('Parser: Skipping entry due to missing/invalid essential fields:', entry);
    }
  }
  
  // Sort data by Date
  processedData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

  console.log('Parser: Finished parsing. Found devices:', Array.from(deviceNames));
  console.log('Parser: Example of processedData entry (first 5):', processedData.slice(0, 5)); // Log a sample of processed data
  console.log('Parser: Total processed data entries:', processedData.length);

  return {
    devices: Array.from(deviceNames),
    data: processedData
  };
}