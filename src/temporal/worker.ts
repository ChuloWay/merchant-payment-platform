import { NestFactory } from '@nestjs/core';
import { Worker } from '@temporalio/worker';
import { AppModule } from '../app.module';
import * as activities from './activities/payment.activities';
import { Logger } from '@nestjs/common';

async function run() {
  const logger = new Logger('TemporalWorker');
  
  logger.log('Starting Temporal Worker...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'payment-processing',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  logger.log(`Temporal Worker started successfully`);
  logger.log(`Task Queue: ${process.env.TEMPORAL_TASK_QUEUE || 'payment-processing'}`);
  logger.log(`Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);

  await worker.run();

  process.on('SIGINT', async () => {
    logger.log('Shutting down Temporal Worker...');
    await worker.shutdown();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Shutting down Temporal Worker...');
    await worker.shutdown();
    await app.close();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('Fatal error in Temporal Worker:', err);
  process.exit(1);
});

