import Chart from 'chart.js/auto';

/**
 * Manages chart data and rendering for device properties.
 * Functions: renderCharts, aggregateData, filterByTimeRange, initializeNewDevice
 */
class ChartManager {
  /**
   * @param {HTMLElement} chartsContainer - The container element for charts.
   * @param {Array} devicesData - The data for all devices.
   */
  constructor(chartsContainer, devicesData = []) {
    // Global array to store chart data: [{ propertyKey, labels, data }]
    this.deviceChartsData = [];
    // Global array to store active Chart.js instances
    this.activeCharts = [];
    this.devicesData = devicesData;
    this.chartsContainer = chartsContainer;
  }

  /**
   * initializes new device and renders charts
   */
  initializeNewDevice(selectedDeviceName) {
    this.deviceName = selectedDeviceName;
    this.aggregateData('raw');
    this.renderCharts('line');
  }

  /**
   * Filters and aggregates data for a specific device, updating deviceChartsData.
   * @param {string} type - Aggregation type ('raw', 'hourly', 'threeHourly', 'daily', 'dailyMinMax').
   */
  aggregateData(type = this.aggregationType) {
    // Clear previous data for the device
    console.log("aggragate type: ", type);
    this.deviceChartsData = [];
    this.aggregationType = type;

    // Filter data for the selected device
    const deviceData = this.devicesData.filter(entry => entry.uName === this.deviceName);
    console.log('Filtered device data length:', deviceData.length);

    if (deviceData.length === 0) {
      console.warn(`No data found for device: ${this.deviceName}`);
      return;
    }

    // Get unique property keys, excluding non-numeric system fields
    const propertyKeys = new Set();
    deviceData.forEach(entry => {
      if (entry.data && typeof entry.data === 'object') {
        for (const key in entry.data) {
          propertyKeys.add(key);
        }
      }
    });
    console.log('Property keys:', Array.from(propertyKeys));

    if (propertyKeys.size === 0) {
      console.warn(`No property data found for device: ${this.deviceName}`);
      return;
    }

    // Prepare data for each property
    propertyKeys.forEach(propertyKey => {
      // Filter valid numeric entries
      const validEntries = deviceData
        .filter(entry => {
          const value = entry.data[propertyKey];
          const date = new Date(entry.Date);
          return value != null && typeof value !== 'string' && !isNaN(value) && !isNaN(date);
        })
        .map(entry => ({
          Date: entry.Date,
          value: entry.data[propertyKey]
        }));

      if (validEntries.length === 0) {
        console.warn(`No valid data for property: ${propertyKey}`);
        return;
      }

      // Aggregate data based on type
      let aggregated = validEntries;
      if (type !== 'raw') {
        const grouped = {};
        validEntries.forEach(entry => {
          const date = new Date(entry.Date);
          let key;

          if (type === 'hourly') {
            key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`;
          } else if (type === 'threeHourly') {
            const threeHourBlock = Math.floor(date.getHours() / 3) * 3;
            key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${threeHourBlock}:00`;
          } else if (type === 'daily' || type === 'dailyMinMax') {
            key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          }

          if (!grouped[key]) {
            grouped[key] = { values: [], date: key };
          }
          grouped[key].values.push(entry.value);
        });

        aggregated = Object.values(grouped).map(group => {
          let value;
          if (type === 'dailyMinMax') {
            value = {
              min: Math.min(...group.values.filter(v => !isNaN(v))),
              max: Math.max(...group.values.filter(v => !isNaN(v)))
            };
          } else {
            const validValues = group.values.filter(v => !isNaN(v));
            value = validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : NaN;
          }
          return { Date: group.date, value };
        });

        aggregated = aggregated.filter(entry => !isNaN(entry.value) || (type === 'dailyMinMax' && !isNaN(entry.value.min) && !isNaN(entry.value.max)));
      }

      // Prepare labels and data for Chart.js
      let labels, data;
      if (type === 'dailyMinMax') {
        labels = aggregated.map(entry => entry.Date);
        data = [
          aggregated.map(entry => entry.value.min),
          aggregated.map(entry => entry.value.max)
        ];
      } else {
        labels = aggregated.map(entry => entry.Date);
        data = aggregated.map(entry => entry.value);
      }

      this.deviceChartsData.push({ propertyKey, labels, data });
    });
  }

  /**
   * Filters data in deviceChartsData by time range.
   * @param {string} startTime - Start time in ISO format (e.g., '2025-07-03T00:00:00').
   * @param {string} endTime - End time in ISO format (e.g., '2025-07-03T23:59:59').
   */
  filterByTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
      console.warn('Invalid startTime or endTime');
      return;
    }
    this.aggregateData();

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end)) {
      console.warn('Invalid startTime or endTime format');
      return;
    }

    this.deviceChartsData = this.deviceChartsData.map(item => {
      const filteredIndices = item.labels
        .map((label, index) => ({ label, index }))
        .filter(({ label }) => {
          const date = new Date(label);
          return date >= start && date <= end;
        })
        .map(({ index }) => index);

      if (filteredIndices.length === 0) {
        console.warn(`No data within time range for property: ${item.propertyKey}`);
        return null;
      }

      const filteredLabels = filteredIndices.map(index => item.labels[index]);
      let filteredData;
      if (Array.isArray(item.data[0])) { // dailyMinMax
        filteredData = [
          filteredIndices.map(index => item.data[0][index]),
          filteredIndices.map(index => item.data[1][index])
        ];
      } else {
        filteredData = filteredIndices.map(index => item.data[index]);
      }

      return { propertyKey: item.propertyKey, labels: filteredLabels, data: filteredData };
    }).filter(item => item !== null);
  }

  /**
   * Renders charts using deviceChartsData.
   * @param {string} chartType - Chart type ('line', 'bar', 'scatter').
   */
  renderCharts(chartType = this.chartType) {
    this.activeCharts.forEach(chart => chart.destroy());
    this.activeCharts = [];
    this.chartsContainer.innerHTML = '';
    this.chartType = chartType;
    if (this.deviceChartsData.length === 0) {
      this.chartsContainer.innerHTML = '<p>No property data to display.</p>';
      console.warn('No chart data provided for rendering');
      return;
    }
    console.log("chart Type: ", chartType);

    // Create a chart for each property
    this.deviceChartsData.forEach(({ propertyKey, labels, data }) => {
      if (data.length === 0) {
        console.warn(`No data to render for property: ${propertyKey}`);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.id = `chart-${propertyKey}`;
      this.chartsContainer.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      try {
        let datasets;
        if (Array.isArray(data[0])) { // dailyMinMax
          datasets = [
            {
              label: `${propertyKey} (Min)`,
              data: data[0],
              borderColor: 'rgba(100, 108, 255, 1)',
              backgroundColor: 'rgba(100, 108, 255, 0.2)',
              fill: chartType === 'line' ? true : false,
              tension: chartType === 'line' ? 0.1 : 0,
              pointRadius: chartType === 'scatter' ? 5 : 0
            },
            {
              label: `${propertyKey} (Max)`,
              data: data[1],
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              fill: chartType === 'line' ? true : false,
              tension: chartType === 'line' ? 0.1 : 0,
              pointRadius: chartType === 'scatter' ? 5 : 0
            }
          ];
        } else {
          datasets = [{
            label: propertyKey,
            data,
            borderColor: 'rgba(100, 108, 255, 1)',
            backgroundColor: 'rgba(100, 108, 255, 0.2)',
            borderWidth: chartType === 'bar' ? 2 : 1,
            fill: chartType === 'line' ? true : false,
            tension: chartType === 'line' ? 0.1 : 0,
            pointRadius: chartType === 'scatter' ? 3 : 0
          }];
        }

        const chartConfig = {
          type: chartType,
          data: {
            labels,
            datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              x: {
                type: 'category',
                title: {
                  display: true,
                  text: 'Time'
                }
              },
              y: {
                title: {
                  display: true,
                  text: datasets.length > 1 ? 'Min/Max Value' : 'Value'
                }
              }
            },
            plugins: {
              title: {
                display: true,
                text: `${propertyKey} (${chartType.charAt(0).toUpperCase() + chartType.slice(1)})`
              }
            }
          }
        };

        const newChart = new Chart(ctx, chartConfig);
        this.activeCharts.push(newChart);
      } catch (error) {
        console.error(`Error creating chart for ${propertyKey}:`, error);
      }
    });
  }
}

export default ChartManager;