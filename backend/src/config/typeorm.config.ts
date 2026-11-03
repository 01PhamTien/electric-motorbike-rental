import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const required = (name: string, fallback: string): string => {
    const value = process.env[name];
    if (isProduction && !value) throw new Error(`Missing required environment variable: ${name}`);
    return value || fallback;
  };

  const synchronize = !isProduction && process.env.DB_SYNCHRONIZE !== 'false';
  return {
    type: 'mysql',
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3307),
    username: required('DB_USERNAME', 'emr'),
    password: required('DB_PASSWORD', 'emr123456'),
    database: required('DB_DATABASE', 'electric_motorbike_rental'),
    autoLoadEntities: true,
    // Never permit automatic schema changes in production.
    synchronize,
    timezone: '+07:00',
    logging: false,
  };
};
