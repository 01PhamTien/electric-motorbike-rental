import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName=process.env.DB_DATABASE||'';
if(process.env.DB_TYPE!=='mssql'||!/^[a-zA-Z0-9_]+_test$/.test(dbName))throw new Error('Refusing SQL Server battery cost schema test: DB_DATABASE must end in _test');

test('SQL Server: battery operating cost ledger constraints and indexes exist',async()=>{
  const ds=new DataSource({...sqlServerConnectionOptions(),entities:[join(__dirname,'../src/modules/**/*.entity.ts')],synchronize:false,dropSchema:false});
  await ds.initialize();
  try{
    const rows=await ds.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_operating_costs'");
    const columns=new Set(rows.map((r:{COLUMN_NAME:string})=>r.COLUMN_NAME));
    for(const name of ['batteryId','stationId','costType','amount','energyKwh','unitPrice','maintenanceTaskId','recordedById','occurredAt','note'])assert.ok(columns.has(name),'Missing battery_operating_costs column: '+name);
    const indexes=await ds.query("SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('battery_operating_costs')");
    for(const name of ['IDX_battery_cost_station_occurred','IDX_battery_cost_battery_occurred','UX_battery_cost_maintenance_task'])assert.ok(indexes.some((r:{name:string})=>r.name===name),'Missing index: '+name);
  }finally{await ds.destroy();}
});
