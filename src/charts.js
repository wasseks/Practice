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
    // Global array to store chart data: [{ propertyKey, labels, data: [{serial, values}] }]
    this.deviceChartsData = [];
    // Global array to store active Chart.js instances
    this.activeCharts = [];
    this.devicesData = devicesData;
    this.chartsContainer = chartsContainer;
    this.aggregationType = 'raw';
    this.chartType = 'line';
  }

  /**
   * Initializes new device and renders charts
   */
  initializeNewDevice(selectedDeviceName) {
    this.deviceName = selectedDeviceName;
    this.chartType = 'line';
    this.aggregateData();
    this.renderCharts();
  }

  /**
   * Filters and aggregates data for a specific device, updating deviceChartsData.
   * @param {string} type - Aggregation type ('raw', 'hourly', 'threeHourly', 'daily', 'dailyMinMax').
   * deviceChartsData - array of objects {string: propertyKey, string_array: labels, data: [{serial, values}]}
   * where data contains arrays of values for each serial.
   */
  aggregateData(type = this.aggregationType) {
    // Clear previous data for the device
    console.log("aggregate type: ", type);
    this.deviceChartsData = [];
    this.aggregationType = type;

    // Filter data for the selected device
    const deviceData = this.devicesData.filter(entry => entry.uName === this.deviceName);
    console.log('Filtered device data length:', deviceData.length);

    if (deviceData.length === 0) {
      console.warn(`No data found for device: ${this.deviceName}`);
      return;
    }

    // Get unique properties, excluding non-numeric fields
    const propertyKeys = new Set(deviceData.flatMap(entry => entry.data ? Object.keys(entry.data) : []));
    console.log('Property keys:', Array.from(propertyKeys));

    if (propertyKeys.size === 0) {
      console.warn(`No property data found for device: ${this.deviceName}`);
      return;
    }

    // Prepare data for each property
    propertyKeys.forEach(propertyKey => {
      // Get unique serials for this property
      const serials = new Set(deviceData.map(entry => entry.serial));

      if (serials.size === 0) {
        console.warn(`No valid serials for property: ${propertyKey}`);
        return;
      }
      
      // Prepare data for each serial
      const serialData = Array.from(serials).map(serial => {
        // Filter valid entries for this serial and property
        const validEntries = deviceData
          .filter(entry => {
            const value = entry.data[propertyKey];
            const date = new Date(entry.Date);
            return entry.serial === serial &&
                   value != null &&
                   typeof value !== 'string' &&
                   !isNaN(value) &&
                   !isNaN(date);
          }) // 
          .map(entry => ({
            Date: entry.Date,
            value: entry.data[propertyKey]
          }));

        if (validEntries.length === 0) {
          console.warn(`No valid data for property: ${propertyKey}, serial: ${serial}`);
          return null;
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

          aggregated = aggregated.filter(entry => 
            !isNaN(entry.value) || 
            (type === 'dailyMinMax' && !isNaN(entry.value.min) && !isNaN(entry.value.max))
          );
        }

        return { serial, entries: aggregated };
      }).filter(item => item !== null);

      if (serialData.length === 0) {
        console.warn(`No valid aggregated data for property: ${propertyKey}`);
        return;
      }

      // Prepare labels (use the union of all dates across serials)
      const allDates = new Set();
      serialData.forEach(({ entries }) => {
        entries.forEach(entry => allDates.add(entry.Date));
      });
      const labels = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));

      // Prepare data for each serial, aligning with labels
      const data = serialData.map(({ serial, entries }) => {
        const values = labels.map(label => {
          const entry = entries.find(e => e.Date === label);
          if (type === 'dailyMinMax') {
            return entry ? [entry.value.min, entry.value.max] : [null, null];
          }
          return entry ? entry.value : null;
        });
        return { serial, values };
      });

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
      const filteredData = item.data.map(({ serial, values }) => {
        let filteredValues;
        if (this.aggregationType === 'dailyMinMax') {
          filteredValues = [
            filteredIndices.map(index => values[index] ? values[index][0] : null),
            filteredIndices.map(index => values[index] ? values[index][1] : null)
          ];
        } else {
          filteredValues = filteredIndices.map(index => values[index]);
        }
        return { serial, values: filteredValues };
      });

      return { propertyKey: item.propertyKey, labels: filteredLabels, data: filteredData };
    }).filter(item => item !== null);
  }

  /**
   * Renders charts using deviceChartsData.
   * @param {string} chartType - Chart type ('line', 'bar', 'scatter').
   */
  renderCharts(chartType = this.chartType) {
    // Clear previous charts to render new ones
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

     // Define color palette for different serials
    const colors = [
      'rgba(100, 108, 255, 1)', // Blue
      'rgba(255, 99, 132, 1)',  // Red
      'rgba(75, 192, 192, 1)',  // Teal
      'rgba(255, 159, 64, 1)',  // Orange
      'rgba(153, 102, 255, 1)', // Purple
      'rgba(255, 205, 86, 1)',  // Yellow
      'rgba(0, 128, 0, 1)',     // Green
      'rgba(128, 0, 128, 1)'    // Magenta
    ];

    // Create a chart for each property
    this.deviceChartsData.forEach(({ propertyKey, labels, data }) => {
      if (data.length === 0 || data.every(({ values }) => values.every(v => v === null))) {
        console.warn(`No data to render for property: ${propertyKey}`);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.id = `chart-${propertyKey}`;
      this.chartsContainer.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      try {
        let datasets;
        if (this.aggregationType === 'dailyMinMax') {
          // For dailyMinMax, create two datasets per serial (min and max)
          datasets = data.flatMap(({ serial, values }, index) => {
            const colorIndex = index % colors.length;
            return [
              {
                label: `${propertyKey} (Min, Serial: ${serial})`,
                data: values.map(v => v ? v[0] : null),
                borderColor: colors[colorIndex],
                backgroundColor: colors[colorIndex].replace('1)', '0.2)'),
                fill: chartType === 'line' ? true : false,
                tension: chartType === 'line' ? 0.1 : 0,
                pointRadius: chartType === 'scatter' ? 5 : 0,
                spanGaps: false
              },
              {
                label: `${propertyKey} (Max, Serial: ${serial})`,
                data: values.map(v => v ? v[1] : null),
                borderColor: colors[colorIndex].replace('1)', '0.8)'),
                backgroundColor: colors[colorIndex].replace('1)', '0.1)'),
                fill: chartType === 'line' ? true : false,
                tension: chartType === 'line' ? 0.1 : 0,
                pointRadius: chartType === 'scatter' ? 5 : 0,
                spanGaps: false
              }
            ];
          });
        } else {
          // For other aggregation types, create one dataset per serial and pick color
          datasets = data.map(({ serial, values }, index) => {
            const colorIndex = index % colors.length;
            return {
              label: `${propertyKey} (Serial ${serial})`,
              data: values,
              borderColor: colors[colorIndex],
              backgroundColor: colors[colorIndex].replace('1)', '0.2)'),
              borderWidth: chartType === 'bar' ? 2 : 1,
              fill: chartType === 'line' ? true : false,
              tension: chartType === 'line' ? 0.1 : 0,
              pointRadius: chartType === 'scatter' ? 3 : 0,
              spanGaps: chartType === 'line' ? true : false
            };
          });
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
                },
              },
              y: {
                title: {
                  display: true,
                  text: this.aggregationType === 'dailyMinMax' ? 'Min/Max Value' : 'Value'
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