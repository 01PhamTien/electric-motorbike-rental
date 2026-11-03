import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VehicleModelsService } from '../src/modules/vehicle-models/vehicle-models.service';

test('model image upload accepts PNG and stores opaque filename, rejects SVG and missing model', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'voltgo-photo-test-'));
  const oldDir = process.env.VOLTGO_UPLOAD_DIR;
  process.env.VOLTGO_UPLOAD_DIR = folder;
  const model = { id: 17, imageUrl: null as string | null };
  let saveCount = 0;
  const mockRepo = {
    findOne: async ({where}:{where:{id:number}}) => where.id===17?model:null,
    save: async (item: typeof model) => {saveCount++;return item;},
  };
  const service = new VehicleModelsService(mockRepo as never);
  try {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
    const result = await service.uploadImage(17,{buffer:bytes,size:bytes.length,mimetype:'image/png',originalname:'../../bad-name.png'});
    assert.match(result.imageUrl,/^\/api\/vehicle-models\/images\/[0-9a-f-]{36}\.png$/);
    assert.equal(result.imageUrl,model.imageUrl);
    assert.equal(saveCount,1);
    const stored=await readFile(join(folder,'vehicle-models',result.imageUrl.split('/').pop()!));
    assert.deepEqual(stored,bytes);
    await assert.rejects(()=>service.uploadImage(17,{buffer:Buffer.from('<svg />'),size:7,mimetype:'image/svg+xml',originalname:'danger.svg'}),/Chỉ hỗ trợ ảnh/);
    await assert.rejects(()=>service.uploadImage(999,{buffer:bytes,size:bytes.length,mimetype:'image/png',originalname:'good.png'}),/Không tìm thấy dòng xe/);
    assert.equal(saveCount,1);
  } finally {
    if(oldDir===undefined)delete process.env.VOLTGO_UPLOAD_DIR;
    else process.env.VOLTGO_UPLOAD_DIR=oldDir;
    await rm(folder,{recursive:true,force:true});
  }
});
