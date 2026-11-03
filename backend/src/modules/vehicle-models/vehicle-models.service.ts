import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleModelDto, UpdateVehicleModelDto } from './dto';
import { VehicleModel } from './vehicle-model.entity';

@Injectable()
export class VehicleModelsService {
  constructor(@InjectRepository(VehicleModel) private readonly repo: Repository<VehicleModel>) {}

  findAll() {
    return this.repo.find({ order: { brand: 'ASC', name: 'ASC' } });
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy dòng xe');
    return item;
  }

  async uploadImage(id: number, file?: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    // Verify model before writing; no original filenames are ever used as disk paths.
    const model = await this.findOne(id);
    if (!file?.buffer || !file.size || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Vui lòng chọn ảnh JPEG, PNG hoặc WEBP dưới 5 MB');
    }
    const bytes = file.buffer;
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    const ext = jpeg ? 'jpg' : png ? 'png' : webp ? 'webp' : null;
    const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
    if (!ext || file.mimetype !== mime) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP hợp lệ');
    }
    const folder = resolve(process.env.VOLTGO_UPLOAD_DIR || './uploads', 'vehicle-models');
    const filename = randomUUID() + '.' + ext;
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, filename), bytes, { flag: 'wx' });
    // Keep previous files for now: they may still be served from cached pages.
    model.imageUrl = '/api/vehicle-models/images/' + filename;
    await this.repo.save(model);
    return { imageUrl: model.imageUrl };
  }

  create(dto: CreateVehicleModelDto) {
    return this.repo.save(this.repo.create({ ...dto, specifications: dto.specifications || null, imageUrl: dto.imageUrl || null }));
  }

  async update(id: number, dto: UpdateVehicleModelDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }
}
