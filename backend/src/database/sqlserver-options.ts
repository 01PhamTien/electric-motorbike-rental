import { DataSourceOptions } from 'typeorm';

/**
 * SQL Server Express uses TCP/IP; SQL Authentication is used by the Node driver.
 * Windows Authentication in SSMS alone does not authenticate tedious/mssql.
 */
export function sqlServerConnectionOptions(): DataSourceOptions {
  const production = process.env.NODE_ENV === 'production';
  const required = (name: string, fallback: string): string => {
    const value = process.env[name];
    if (production && !value) throw new Error('Missing production database configuration: ' + name);
    return value || fallback;
  };
  const port = Number(process.env.DB_PORT || '14333');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT is invalid');
  const trustServerCertificate = !production && process.env.DB_TRUST_SERVER_CERTIFICATE === 'true';
  return {
    type: 'mssql',
    host: required('DB_HOST', '127.0.0.1'),
    port,
    username: required('DB_USERNAME', 'voltgo_app'),
    password: required('DB_PASSWORD', ''),
    database: required('DB_DATABASE', 'VoltGoDB'),
    options: {
      encrypt: production || process.env.DB_ENCRYPT === 'true',
      trustServerCertificate,
      enableArithAbort: true,
    },
  };
}
