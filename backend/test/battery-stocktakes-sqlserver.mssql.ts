import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName=process.env.DB_DATABASE||'';
if(process.env.DB_TYPE!=='mssql'||!/^[a-zA-Z0-9_]+_test$/.test(dbName)){
  throw new Error('Refusing SQL Server stocktake schema test: DB_DATABASE must end in _test');
}

test('SQL Server: battery stocktake snapshot, items and single-open constraint are migrated',async()=>{
  const dataSource=new DataSource({...sqlServerConnectionOptions(),entities:[join(__dirname,'../src/modules/**/*.entity.ts')],synchronize:false,dropSchema:false});
  await dataSource.initialize();
  try{
    const headerRows=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_stocktakes'");
    const headerColumns=new Set(headerRows.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['stationId','createdById','completedById','approvedById','status','heldReservationCount','completedAt','approvedAt']){
      assert.ok(headerColumns.has(name),'Missing battery_stocktakes column: '+name);
    }
    const itemRows=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_stocktake_items'");
    const itemColumns=new Set(itemRows.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['stocktakeId','batteryId','serialSnapshot','systemStatus','systemVehicleId','systemUpdatedAt','exempt','countStatus','observedStatus','note']){
      assert.ok(itemColumns.has(name),'Missing battery_stocktake_items column: '+name);
    }
    const indexes=await dataSource.query("SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('battery_stocktakes')");
    assert.ok(indexes.some((row:{name:string})=>row.name==='UX_battery_stocktakes_one_open_per_station'));
    assert.ok(indexes.some((row:{name:string})=>row.name==='IDX_battery_stocktakes_station_status'));
  }finally{await dataSource.destroy();}
});
