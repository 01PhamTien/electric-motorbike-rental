import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { sqlServerConnectionOptions } from '../database/sqlserver-options';

/** VoltGo currently supports SQL Server only. Use explicit migrations, never runtime schema synchronization. */
export const typeOrmConfig = (): TypeOrmModuleOptions => {
  if (process.env.DB_TYPE && process.env.DB_TYPE !== 'mssql') {
    throw new Error('VoltGo currently supports SQL Server only. Set DB_TYPE=mssql.');
  }
  return {
    ...sqlServerConnectionOptions(),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  } as TypeOrmModuleOptions;
};
