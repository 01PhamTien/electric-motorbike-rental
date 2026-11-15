import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName=process.env.DB_DATABASE||'';
if(process.env.DB_TYPE!=='mssql'||!/^[a-zA-Z0-9_]+_test$/.test(dbName)){
  throw new Error('Refusing SQL Server battery health schema test: DB_DATABASE must end in _test');
}

test('SQL Server: battery health history and maintenance tables are migrated',async()=>{
  const dataSource=new DataSource({...sqlServerConnectionOptions(),entities:[join(__dirname,'../src/modules/**/*.entity.ts')],synchronize:false,dropSchema:false});
  await dataSource.initialize();
  try{
    const health=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_health_checks'");
    const healthColumns=new Set(health.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['batteryId','stationId','healthPercent','cycleCount','note','recordedById','createdAt'])assert.ok(healthColumns.has(name),'Missing battery_health_checks column: '+name);
    const tasks=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_maintenance_tasks'");
    const taskColumns=new Set(tasks.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['batteryId','stationId','createdById','completedById','taskType','priority','status','dueAt','description','result','cost','startedAt','completedAt'])assert.ok(taskColumns.has(name),'Missing battery_maintenance_tasks column: '+name);
    const indexes=await dataSource.query("SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('battery_maintenance_tasks')");
    assert.ok(indexes.some((row:{name:string})=>row.name==='IDX_battery_maintenance_station_status_due'));
  }finally{await dataSource.destroy();}
});
