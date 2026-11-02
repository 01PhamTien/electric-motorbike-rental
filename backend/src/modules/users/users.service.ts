import { ConflictException, Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Station } from '../stations/station.entity';
import { ChangePasswordDto, CreateStaffDto, UpdateMyProfileDto, UpdateStaffDto } from './dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id }, relations: { station: true } });
  }

  findByEmailWithPassword(email: string) {
    return this.repo.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  async listStaff() {
    return this.repo.createQueryBuilder('user')
      .leftJoinAndSelect('user.station', 'station')
      .where('user.role = :role', { role: Role.STAFF })
      .orderBy('user.id', 'DESC')
      .getMany();
  }


  async updateMyProfile(id: number, dto: UpdateMyProfileDto) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.repo.findOneBy({ email });
      if (existing && existing.id !== id) throw new ConflictException('Email đã được sử dụng');
      user.email = email;
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone?.trim() || null;
      if (phone) {
        const existing = await this.repo.findOneBy({ phone });
        if (existing && existing.id !== id) throw new ConflictException('Số điện thoại đã được sử dụng');
      }
      user.phone = phone;
    }
    if (dto.fullName !== undefined) {
      const fullName = dto.fullName.trim();
      if (!fullName) throw new BadRequestException('Họ tên không được để trống');
      user.fullName = fullName;
    }
    await this.repo.save(user);
    return this.findById(id);
  }

  async changePassword(id: number, dto: ChangePasswordDto) {
    const user = await this.repo.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.save(user);
    return { success: true, message: 'Đổi mật khẩu thành công' };
  }

  async updateAvatar(id: number, file: { mimetype: string; buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn ảnh đại diện');
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP');
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    const directory = join(process.cwd(), 'uploads', 'users');
    await mkdir(directory, { recursive: true });
    const filename = randomUUID() + extension;
    await writeFile(join(directory, filename), file.buffer);
    user.avatarUrl = '/uploads/users/' + filename;
    await this.repo.save(user);
    return this.findById(id);
  }

  private async activeStation(stationId: number) {
    const station = await this.stations.findOneBy({ id: stationId, isActive: true });
    if (!station) throw new BadRequestException('Điểm thuê không tồn tại hoặc đang ngừng hoạt động');
    return station;
  }

  async createStaff(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.repo.findOneBy({ email })) throw new ConflictException('Email đã được sử dụng');
    if (dto.phone && await this.repo.findOneBy({ phone: dto.phone.trim() })) throw new ConflictException('Số điện thoại đã được sử dụng');
    const station = await this.activeStation(dto.stationId);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const staff = this.repo.create({
      fullName: dto.fullName.trim(), email, phone: dto.phone?.trim() || null,
      passwordHash, role: Role.STAFF, status: UserStatus.ACTIVE, stationId: station.id, station,
    });
    const saved = await this.repo.save(staff);
    return this.findStaffById(saved.id);
  }

  async findStaffById(id: number) {
    const staff = await this.repo.findOne({ where: { id, role: Role.STAFF }, relations: { station: true } });
    if (!staff) throw new NotFoundException('Không tìm thấy nhân viên');
    return staff;
  }

  async updateStaff(id: number, dto: UpdateStaffDto) {
    const staff = await this.findStaffById(id);
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.repo.findOneBy({ email });
      if (existing && existing.id !== id) throw new ConflictException('Email đã được sử dụng');
      staff.email = email;
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone?.trim() || null;
      if (phone) {
        const existing = await this.repo.findOneBy({ phone });
        if (existing && existing.id !== id) throw new ConflictException('Số điện thoại đã được sử dụng');
      }
      staff.phone = phone;
    }
    if (dto.fullName !== undefined) staff.fullName = dto.fullName.trim();
    if (dto.stationId !== undefined) {
      const station = await this.activeStation(dto.stationId);
      staff.station = station;
      staff.stationId = station.id;
    }
    await this.repo.save(staff);
    return this.findStaffById(id);
  }

  async updateStaffStatus(id: number, status: UserStatus) {
    const staff = await this.findStaffById(id);
    if (staff.status === status) return staff;
    staff.status = status;
    await this.repo.save(staff);
    return this.findStaffById(id);
  }
}
