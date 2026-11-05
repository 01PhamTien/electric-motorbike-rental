import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName=process.env.DB_DATABASE||'';
if(process.env.DB_TYPE!=='mssql'||!/^[a-zA-Z0-9_]+_test$/.test(dbName)){
  throw new Error('Refusing SQL Server schema test: DB_DATABASE must end in _test');
}

test('SQL Server: battery inventory and swap history schema are migrated',async()=>{
  const dataSource=new DataSource({...sqlServerConnectionOptions(),entities:[join(__dirname,'../src/modules/**/*.entity.ts')],synchronize:false,dropSchema:false});
  await dataSource.initialize();
  try{
    const batteryRows=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='batteries'");
    const batteryColumns=new Set(batteryRows.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['serialNumber','stationId','vehicleId','status','capacityKwh','healthPercent','cycleCount','lastChargedAt','note']){
      assert.ok(batteryColumns.has(name),'Missing batteries column: '+name);
    }
    const swapRows=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_swaps'");
    const swapColumns=new Set(swapRows.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['vehicleId','stationId','removedBatteryId','installedBatteryId','performedById','createdAt']){
      assert.ok(swapColumns.has(name),'Missing battery swap column: '+name);
    }
    const indexes=await dataSource.query("SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('batteries')");
    assert.ok(indexes.some((row:{name:string})=>row.name==='IDX_batteries_station_status'));
  }finally{await dataSource.destroy();}
});
