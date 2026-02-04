# energygrid-client
EnergyGrid Data Aggregator - Fetches telemetry from 500 solar inverters

# ⚡ EnergyGrid Data Aggregator

A robust Node.js client application for fetching real-time telemetry data from 500 solar inverters via the EnergyGrid API.

## 🎯 Features

- **Batch Processing**: Efficiently handles 500 devices in batches of 10 (API limit)
- **Rate Limiting**: Strict 1 request/second enforcement to prevent HTTP 429 errors
- **Security**: Proper MD5 signature generation for API authentication
- **Error Handling**: Exponential backoff retry mechanism for failed requests
- **Data Aggregation**: Comprehensive statistics and device status summary

## 🚀 Quick Start

### Prerequisites

- Node.js v14+ 
- Mock API server running on `localhost:3000`

### Installation

```bash
npm install
