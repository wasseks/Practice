import { parseData } from './parser.js';
import ChartManager from './charts.js';

/**
 * Manages the application interface and state.
 */
class AppManager {
  constructor() {
    // DOM Elements
    this.initialPage = document.getElementById('initialPage');
    this.parseJsonButton = document.getElementById('parseJson');
    this.devicesPage = document.getElementById('devicesPage');
    this.devicesButtonsContainer = document.getElementById('devicesButtons');
    this.devicesBackButton = document.getElementById('devicesBackButton');
    this.chartsPage = document.getElementById('chartsPage');
    this.chartTitle = document.getElementById('chartTitle');
    this.chartsBackButton = document.getElementById('chartsBackButton');
    this.chartsContainer = document.getElementById('chartsContainer');
    this.chartControls = document.getElementById('chartControls');

    // Application state
    this.devices = [];

    // Chart manager instance
    this.chartManager = new ChartManager(this.chartsContainer);

    // Initialize event listeners
    this.initializeEventListeners();
  }

  /**
   * Initializes event listeners for buttons and dropdowns.
   */
  initializeEventListeners() {
    // Load JSON button
    this.parseJsonButton.addEventListener('click', () => this.handleParseJson());

    // Devices page back button
    this.devicesBackButton.addEventListener('click', () => this.showInitialPage());

    // Charts page back button
    this.chartsBackButton.addEventListener('click', () => this.showDevicesPage());

    // Chart type dropdown
    this.initializeChartTypeDropdown();

    // Aggregation dropdown
    this.initializeAggregationDropdown();

    // Time range button
    this.initializeTimeRangeButton();

    // Time range modal
    this.initializeTimeRangeModal();
  }

  /**
   * Initializes chart type dropdown event listeners.
   */
  initializeChartTypeDropdown() {
    const chartTypeMenu = this.chartControls.querySelector('[data-type="chartType"] .dropdown-menu');
    if (!chartTypeMenu) {
      console.warn('Chart type dropdown menu not found');
      return;
    }

    const items = chartTypeMenu.querySelectorAll('a');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const value = item.dataset.value;
        const text = item.textContent;

        // Update chart type and button text
        this.updateDropdownText('chartType', text);

        // Re-render charts with with updated chart type
        this.chartManager.renderCharts(value);
      });
    });
  }

  /**
   * Initializes aggregation dropdown event listeners.
   */
  initializeAggregationDropdown() {
    const aggregationMenu = this.chartControls.querySelector('[data-type="aggregation"] .dropdown-menu');
    if (!aggregationMenu) {
      console.warn('Aggregation dropdown menu not found');
      return;
    }

    const items = aggregationMenu.querySelectorAll('a');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const value = item.dataset.value;
        const text = item.textContent;

        // Update aggregation type and button text
        this.updateDropdownText('aggregation', text);
        this.chartManager.aggregateData(value);
        this.chartManager.renderCharts();
      });
    });
  }

  /**
   * Initializes time range button event listener.
   */
  initializeTimeRangeButton() {
    const timeRangeButton = this.chartControls.querySelector('.time-range-button');
    if (!timeRangeButton) {
      console.warn('Time range button not found');
      return;
    }

    timeRangeButton.addEventListener('click', () => {
      const modalId = timeRangeButton.dataset.toggleModal;
      const modal = document.querySelector(modalId);
      if (modal) {
        modal.style.display = 'flex';
      } else {
        console.warn(`Modal with ID ${modalId} not found`);
      }
    });
  }

  /**
   * Initializes time range modal event listeners.
   */
  initializeTimeRangeModal() {
    const applyButton = document.querySelector('#timeRangeModal .modal-button-primary');
    const cancelButton = document.querySelector('#timeRangeModal .modal-button-secondary');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');

    if (!applyButton || !cancelButton || !startTimeInput || !endTimeInput) {
      console.warn('Time range modal elements not found');
      return;
    }

    applyButton.addEventListener('click', () => {
      const startTime = startTimeInput.value;
      const endTime = endTimeInput.value;
      if (startTime && endTime) {
        this.chartManager.filterByTimeRange(startTime, endTime);
        this.chartManager.renderCharts();
        const modal = document.getElementById('timeRangeModal');
        modal.style.display = 'none';
      }
    });

    cancelButton.addEventListener('click', () => {
      const modal = document.getElementById('timeRangeModal');
      modal.style.display = 'none';
    });
  }

  /**
   * Updates the dropdown button text based on the selected option.
   * @param {string} type - The type of dropdown ('chartType' or 'aggregation').
   * @param {string} text - The text to display on the button.
   */
  updateDropdownText(type, text) {
    const button = this.chartControls.querySelector(`.dropdown[data-type="${type}"] .dropdown-button`);
    if (button) {
      button.textContent = text;
    } else {
      console.warn(`Dropdown button for type "${type}" not found`);
    }
  }

  /**
   * Shows the initial page and resets state.
   */
  showInitialPage() {
    this.devicesPage.style.display = 'none';
    this.chartsPage.style.display = 'none';
    this.initialPage.style.display = 'flex';
  }

  /**
   * Shows the devices page with buttons for each device.
   */
  showDevicesPage() {
    this.devicesButtonsContainer.innerHTML = ''; // Clear previous buttons

    this.devices.forEach(deviceName => {
      const button = document.createElement('button');
      button.textContent = deviceName;
      button.className = 'device-button';

      button.addEventListener('click', () => {
        this.showChartsPage(deviceName);
      });

      this.devicesButtonsContainer.appendChild(button);
    });

    this.initialPage.style.display = 'none';
    this.chartsPage.style.display = 'none';
    this.devicesPage.style.display = 'flex';
  }

  /**
   * Shows the charts page for the selected device and renders charts.
   * @param {string} deviceName - The name of the selected device.
   */
  showChartsPage(deviceName) {
    this.chartTitle.textContent = `Charts for ${deviceName}`;

    // Reset chart type and aggregation to default
    this.updateDropdownText('chartType', 'Line');
    this.updateDropdownText('aggregation', 'Raw Data');

    // Prepare and render charts
    this.chartManager.initializeNewDevice(deviceName);

    this.devicesPage.style.display = 'none';
    this.chartsPage.style.display = 'flex';
  }

  /**
   * Handles the "Load JSON" button click.
   */
  async handleParseJson() {
    try {
      // Use API from preload.js to open a file dialog
      const result = await window.electronAPI.openFileDialog();
      if (result.canceled || result.error) {
        console.log('File selection canceled or an error occurred.');
        return;
      }

      // Parse the data using our module
      const parsed = parseData(result.data);

      // Store the result in our variables
      this.devices = parsed.devices;
      this.chartManager.devicesData = parsed.data; // Update ChartManager's devicesData

      console.log('Found devices:', this.devices);

      // Display the page with device buttons
      this.showDevicesPage();
    } catch (error) {
      console.error('Failed to process the file:', error);
      alert('An error occurred while processing the file.');
    }
  }
}

// Initialize the application
const app = new AppManager();