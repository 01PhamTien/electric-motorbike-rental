import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { VehiclesService } from '../src/modules/vehicles/vehicles.service';

test('vehicle gallery only stores HTTP(S) URLs and scopes deletion to the selected vehicle', async () => {
  const saved: Array<{vehicleId:number;imageUrl:string}> = [];
  const removed: Array<{id:number;vehicleId:number;imageUrl:string}> = [];
  const vehicleRepo = {
    findOneBy: async ({id}:{id:number}) => id === 7 ? {id:7} : null,
    findOne: async () => null,
    create: (value: unknown) => value,
    save: async (value: unknown) => value,
    find: async () => [],
    createQueryBuilder: () => { throw new Error('not used'); },
  };
  const imageRepo = {
    create: (value: {vehicleId:number;imageUrl:string}) => value,
    save: async (value: {vehicleId:number;imageUrl:string}) => { saved.push(value); return {id:11,...value}; },
    findOneBy: async ({id,vehicleId}:{id:number;vehicleId:number}) => id === 11 && vehicleId === 7 ? {id,vehicleId,imageUrl:'https://cdn.example.test/vehicle.jpg'} : null,
    remove: async (value: {id:number;vehicleId:number;imageUrl:string}) => { removed.push(value); },
  };
  const service = new VehiclesService(vehicleRepo as never, {} as never, {} as never, imageRepo as never);
  const created = await service.addImage(7, ' https://cdn.example.test/vehicle.jpg ');
  assert.equal(created.imageUrl, 'https://cdn.example.test/vehicle.jpg');
  assert.equal(saved.length, 1);
  await assert.rejects(() => service.addImage(7, 'javascript:alert(1)'), /URL HTTP\(S\)/);
  await assert.rejects(() => service.addImage(7, 'data:image/png;base64,AAAA'), /URL HTTP\(S\)/);
  await assert.rejects(() => service.addImage(7, 'not-a-url'), /không hợp lệ/);
  await assert.rejects(() => service.addImage(999, 'https://cdn.example.test/vehicle.jpg'), /Không tìm thấy xe/);
  await assert.rejects(() => service.removeImage(7, 12), /Không tìm thấy ảnh thuộc xe này/);
  await service.removeImage(7, 11);
  assert.equal(removed.length, 1);
});
