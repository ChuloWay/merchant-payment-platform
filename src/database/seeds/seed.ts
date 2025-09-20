import { AppDataSource } from '../data-source';
import { MerchantsSeed } from './merchants.seed';

async function runSeeds() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');

    const merchantsSeed = new MerchantsSeed();
    await merchantsSeed.run(AppDataSource);

    console.log('Seeds completed successfully');
  } catch (error) {
    console.error('Error running seeds:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

void runSeeds();
