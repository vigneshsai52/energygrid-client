const crypto = require('crypto');
const http = require('http');

class EnergyGridClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.token = options.token || 'interview_token_123';
    this.endpoint = '/device/real/query';
    
    this.minRequestInterval = 1000;
    this.lastRequestTime = 0;
    
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      totalDevices: 0
    };
  }

  generateSignature(timestamp) {
    const url = this.endpoint;
    const data = url + this.token + timestamp;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await this.sleep(delay);
    }
    
    this.lastRequestTime = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(serialNumbers) {
    await this.enforceRateLimit();
    
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp);
    
    const postData = JSON.stringify({ sn_list: serialNumbers });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: this.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'timestamp': timestamp,
        'signature': signature
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: parsed, statusCode: res.statusCode });
            } else {
              resolve({ success: false, error: parsed.error || 'Unknown error', statusCode: res.statusCode });
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async executeWithRetry(serialNumbers, attempt = 1) {
    try {
      this.stats.totalRequests++;
      const result = await this.makeRequest(serialNumbers);
      
      if (result.success) {
        this.stats.successfulRequests++;
        return result.data;
      }
      
      if ((result.statusCode === 429 || result.statusCode >= 500) && attempt < this.maxRetries) {
        this.stats.retriedRequests++;
        const backoffDelay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`  ⚠️  Attempt ${attempt} failed (${result.statusCode}: ${result.error}). Retrying in ${backoffDelay}ms...`);
        await this.sleep(backoffDelay);
        return this.executeWithRetry(serialNumbers, attempt + 1);
      }
      
      this.stats.failedRequests++;
      throw new Error(`Request failed: ${result.error} (HTTP ${result.statusCode})`);
      
    } catch (error) {
      if (attempt < this.maxRetries) {
        this.stats.retriedRequests++;
        const backoffDelay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`  ⚠️  Network error on attempt ${attempt}: ${error.message}. Retrying in ${backoffDelay}ms...`);
        await this.sleep(backoffDelay);
        return this.executeWithRetry(serialNumbers, attempt + 1);
      }
      this.stats.failedRequests++;
      throw error;
    }
  }

  async fetchBatch(serialNumbers) {
    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      throw new Error('serialNumbers must be a non-empty array');
    }
    if (serialNumbers.length > 10) {
      throw new Error('Batch size cannot exceed 10 devices');
    }
    
    return await this.executeWithRetry(serialNumbers);
  }

  generateSerialNumbers(count = 500) {
    return Array.from({ length: count }, (_, i) => 
      `SN-${String(i).padStart(3, '0')}`
    );
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async aggregateAllData(options = {}) {
    const totalDevices = options.totalDevices || 500;
    const batchSize = options.batchSize || 10;
    
    console.log(`\n🚀 Starting aggregation of ${totalDevices} devices...`);
    console.log(`   Batch size: ${batchSize}, Estimated time: ~${Math.ceil(totalDevices/batchSize)} seconds\n`);
    
    const serialNumbers = this.generateSerialNumbers(totalDevices);
    const batches = this.chunkArray(serialNumbers, batchSize);
    
    const aggregated = {
      devices: [],
      summary: {
        total: 0,
        online: 0,
        offline: 0,
        totalPower: 0,
        averagePower: 0,
        failedBatches: []
      },
      metadata: {
        startedAt: new Date().toISOString(),
        batchesTotal: batches.length,
        batchesCompleted: 0
      }
    };

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const progress = `[${String(i + 1).padStart(2)}/${batches.length}]`;
      
      try {
        process.stdout.write(`${progress} Fetching ${batch.length} devices... `);
        const response = await this.fetchBatch(batch);
        
        if (response.data && Array.isArray(response.data)) {
          aggregated.devices.push(...response.data);
          aggregated.metadata.batchesCompleted++;
          
          response.data.forEach(device => {
            aggregated.summary.total++;
            if (device.status === 'Online') aggregated.summary.online++;
            if (device.status === 'Offline') aggregated.summary.offline++;
            const power = parseFloat(device.power);
            if (!isNaN(power)) aggregated.summary.totalPower += power;
          });
          
          console.log(`✓ Success (${response.data.length} devices)`);
        }
      } catch (error) {
        console.log(`✗ Failed: ${error.message}`);
        aggregated.summary.failedBatches.push({
          batchIndex: i,
          devices: batch,
          error: error.message
        });
      }
    }

    if (aggregated.summary.total > 0) {
      aggregated.summary.averagePower = (aggregated.summary.totalPower / aggregated.summary.total).toFixed(2);
      aggregated.summary.totalPower = aggregated.summary.totalPower.toFixed(2);
    }
    
    aggregated.metadata.completedAt = new Date().toISOString();
    aggregated.metadata.duration = 
      new Date(aggregated.metadata.completedAt) - new Date(aggregated.metadata.startedAt);
    
    this.stats.totalDevices = aggregated.summary.total;
    
    return aggregated;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = EnergyGridClient;
