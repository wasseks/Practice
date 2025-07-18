# HTML structure

- initialPage:

First page with "load json" button to parse json file

- devicesPage:

Second page with devices to pick device from json file to build graph depending on the data this device represents

- chartsPage:

Third page with all the graphs

-modal:

additional page for selecting time range

# Modules structure

## src/index.js:

Responsible for main logic of the application and processing the interface

### Main class for application "AppManager":

- Adds event listeners to all the buttons
- function showInitialPage
- function showDevicesPage
- function showChartsPage
- function handleParseJson
-------------------------------------------------

## src/parser.js:

Resposible for parsing json

Exports a function:

-  parseJson
-------------------------------------------------

## src/charts.js:

Manages chart data and rendering for device properties.

### Exports class "ChartManager" with functions:

- initializeNewDevice
- aggregateData
- filterByTimeRange
- renderCharts
-------------------------------------------------

## main.js:

Loads electron app, responsible for window application and integration with OS(open/close, etc)

-------------------------------------------------

## preload.js:

Preload script for secure IPC communication.
