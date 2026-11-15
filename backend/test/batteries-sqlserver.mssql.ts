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
    const reservationRows=await dataSource.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='battery_reservations'");
    const reservationColumns=new Set(reservationRows.map((row:{COLUMN_NAME:string})=>row.COLUMN_NAME));
    for(const name of ['customerId','stationId','bookingId','vehicleId','status','expiresAt','redeemedAt','cancelledAt','redeemedById','batterySwapId']){
      assert.ok(reservationColumns.has(name),'Missing battery_reservations column: '+name);
    }
    const indexes=await dataSource.query(`SELECT name, is_unique, filter_definition
      FROM sys.indexes WHERE object_id=OBJECT_ID('batteries')`);
    assert.ok(indexes.some((row:{name:string})=>row.name==='IDX_batteries_station_status'));
    const serialUnique=indexes.find((row:{name:string})=>row.name==='UQ_batteries_serial');
    assert.ok(serialUnique,'Missing unique serial number constraint/index');
    assert.equal(serialUnique.is_unique,true);
    const installedIndex=indexes.find((row:{name:string})=>row.name==='UX_batteries_one_installed_per_vehicle');
    assert.ok(installedIndex,'Missing unique filtered index for installed batteries');
    assert.equal(installedIndex.is_unique,true);
    assert.match(String(installedIndex.filter_definition),/INSTALLED/i);

    const constraints=await dataSource.query(`SELECT name FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID('batteries')`);
    const constraintNames=constraints.map((row:{name:string})=>row.name);
    assert.ok(constraintNames.includes('CK_batteries_status'),'Missing battery status check constraint');
    assert.ok(constraintNames.includes('CK_batteries_vehicle_status'),
      'Missing status/vehicle consistency constraint');

    const invalidRows=await dataSource.query(`
      SELECT COUNT(*) AS total
      FROM batteries
      WHERE ([status]='INSTALLED' AND [vehicleId] IS NULL)
         OR ([status]<>'INSTALLED' AND [vehicleId] IS NOT NULL)
    `);
    assert.equal(Number(invalidRows[0].total),0,'Battery status and vehicle assignment are inconsistent');

    const duplicateInstalled=await dataSource.query(`
      SELECT COUNT(*) AS total FROM (
        SELECT vehicleId FROM batteries
        WHERE status='INSTALLED'
        GROUP BY vehicleId HAVING COUNT(*)>1
      ) duplicates
    `);
    assert.equal(Number(duplicateInstalled[0].total),0,'A vehicle has multiple installed batteries');

    const crossStationInstalled=await dataSource.query(`
      SELECT COUNT(*) AS total FROM batteries b
      INNER JOIN vehicles v ON v.id=b.vehicleId
      WHERE b.status='INSTALLED' AND b.stationId<>v.stationId
    `);
    assert.equal(Number(crossStationInstalled[0].total),0,'Installed battery and vehicle belong to different stations');
  }finally{await dataSource.destroy();}
});

test('SQL Server: battery serial numbers are unique at database level',async()=>{
  const dataSource=new DataSource({...sqlServerConnectionOptions(),entities:[join(__dirname,'../src/modules/**/*.entity.ts')],synchronize:false,dropSchema:false});
  await dataSource.initialize();
  const runner=dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try{
    const now=new Date();
    const stationRows=await runner.query(`
      INSERT INTO [stations]([name],[address],[latitude],[longitude],[phone],[isActive],[createdAt],[updatedAt])
      OUTPUT INSERTED.[id]
      VALUES(@0,@1,@2,@3,NULL,1,@4,@4)
    `,['battery-integrity-test-'+Date.now(),'SQL Server constraint test','10.0000000','106.0000000',now]);
    const stationId=stationRows[0].id;
    const serial='INTEGRITY-'+Date.now();
    const insert=()=>runner.query(`
      INSERT INTO [batteries]([serialNumber],[stationId],[vehicleId],[status],[capacityKwh],[healthPercent],[cycleCount],[lastChargedAt],[note],[createdAt],[updatedAt])
      VALUES(@0,@1,NULL,'FULL',NULL,100,0,NULL,NULL,@2,@2)
    `,[serial,stationId,now]);
    await insert();
    await assert.rejects(()=>insert(),/UQ_batteries_serial|unique|duplicate/i);
  }finally{
    await runner.rollbackTransaction();
    await runner.release();
    await dataSource.destroy();
  }
});
