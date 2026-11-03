import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { sqlServerConnectionOptions } from '../database/sqlserver-options';

export const typeOrmConfig = (): TypeOrmModuleOptions => {
  const production = process.env.NODE_ENV === 'production';
  const synchronize = !production && process.env.DB_SYNCHRONIZE !== 'false';
  if (process.env.DB_TYPE === 'mssql') {
    return { ...sqlServerConnectionOptions(), autoLoadEntities: true, synchronize, logging: false } as TypeOrmModuleOptions;
  }
  if (process.env.DB_TYPE && process.env.DB_TYPE !== 'mysql') {
    throw new Error('DB_TYPE must be mysql or mssql');
  }
  const required = (name: string, fallback: string): string => {
    const value = process.env[name];
    if (production && !value) throw new Error('Missing required environment variable: ' + name);
    return value || fallback;
  };
  return {
    type: 'mysql',
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3307),
    username: required('DB_USERNAME', 'emr'),
    password: required('DB_PASSWORD', 'emr123456'),
    database: required('DB_DATABASE', 'electric_motorbike_rental'),
    autoLoadEntities: true,
    synchronize,
    timezone: '+07:00',
    logging: false,
  };
};
