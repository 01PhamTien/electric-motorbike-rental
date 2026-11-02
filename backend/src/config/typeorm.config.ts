import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const isProduction = process.env.NODE_ENV === 'production';

export const typeOrmConfig = (): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  username: process.env.DB_USERNAME || 'emr',
  password: process.env.DB_PASSWORD || 'emr123456',
  database: process.env.DB_DATABASE || 'electric_motorbike_rental',
  autoLoadEntities: true,
  // Never let TypeORM alter a production schema automatically.
  // Development keeps the existing synchronize behavior.
  synchronize: !isProduction,
  timezone: '+07:00',
  logging: !isProduction && process.env.DB_LOGGING === 'true',
});
