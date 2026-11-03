import { Body, Controller, Get, Header, NotFoundException, Param, ParseIntPipe, Patch, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVehicleModelDto, UpdateVehicleModelDto } from './dto';
import { VehicleModelsService } from './vehicle-models.service';

@ApiTags('Vehicle models')
@Controller('vehicle-models')
export class VehicleModelsController {
  constructor(private readonly service: VehicleModelsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('images/:filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async image(@Param('filename') filename: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(filename)) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
    const folder = resolve(process.env.VOLTGO_UPLOAD_DIR || './uploads', 'vehicle-models');
    const file = resolve(folder, filename);
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
    } catch { throw new NotFoundException('Không tìm thấy ảnh'); }
    const type = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return new StreamableFile(createReadStream(file), { type });
  }

  @Post(':id/image')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadImage(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    return this.service.uploadImage(id, file);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateVehicleModelDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleModelDto) {
    return this.service.update(id, dto);
  }
}
