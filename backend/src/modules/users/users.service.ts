import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Station } from '../stations/station.entity';
import { CreateStaffDto, UpdateStaffDto } from './dto';
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
