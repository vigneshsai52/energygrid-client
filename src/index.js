const EnergyGridClient = require('./EnergyGridClient');

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ⚡ EnergyGrid Data Aggregator Client v1.0              ║');
  console.log('║     Fetching real-time telemetry from 500 inverters        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const client = new EnergyGridClient({
    baseUrl: 'http://localhost:3000',
    token: 'interview_token_123',
    maxRetries: 3,
    retryDelay: 1000
  });

  try {
    console.log('\n📡 Connecting to EnergyGrid API at http://localhost:3000...');
    
    const result = await client.aggregateAllData({
      totalDevices: 500,
      batchSize: 10
    });

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('                    📊 AGGREGATION RESULTS                     ');
    console.log('══════════════════════════════════════════════════════════════');
    
    console.log('\n📈 Summary:');
    console.log(`   • Total Devices Processed: ${result.summary.total}/500`);
    console.log(`   • Online: ${result.summary.online} (${((result.summary.online/result.summary.total)*100).toFixed(1)}%)`);
    console.log(`   • Offline: ${result.summary.offline} (${((result.summary.offline/result.summary.total)*100).toFixed(1)}%)`);
    console.log(`   • Total Power Output: ${result.summary.totalPower} kW`);
    console.log(`   • Average Power per Device: ${result.summary.averagePower} kW`);
    
    console.log('\n📋 Request Statistics:');
    const stats = client.getStats();
    console.log(`   • Total API Requests: ${stats.totalRequests}`);
    console.log(`   • Successful: ${stats.successfulRequests}`);
    console.log(`   • Failed: ${stats.failedRequests}`);
    console.log(`   • Retried: ${stats.retriedRequests}`);
    
    console.log('\n⏱️  Performance:');
    console.log(`   • Started: ${new Date(result.metadata.startedAt).toLocaleTimeString()}`);
    console.log(`   • Completed: ${new Date(result.metadata.completedAt).toLocaleTimeString()}`);
    console.log(`   • Duration: ${(result.metadata.duration / 1000).toFixed(2)} seconds`);
    console.log(`   • Batches: ${result.metadata.batchesCompleted}/${result.metadata.batchesTotal}`);
    
    if (result.summary.failedBatches.length > 0) {
      console.log('\n⚠️  Failed Batches:');
      result.summary.failedBatches.forEach(fb => {
        console.log(`   • Batch ${fb.batchIndex}: ${fb.devices.join(', ')}`);
      });
    }

    console.log('\n🔍 Sample Device Data (first 3):');
    result.devices.slice(0, 3).forEach((device, i) => {
      console.log(`   ${i + 1}. ${device.sn}: ${device.power} [${device.status}] @ ${device.last_updated}`);
    });

    console.log('\n✅ Aggregation completed successfully!\n');

    return result;
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, EnergyGridClient };
