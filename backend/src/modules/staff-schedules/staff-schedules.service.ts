import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';
import { CreateStaffScheduleDto, UpdateStaffScheduleDto } from './staff-schedule.dto';
import { StaffSchedule } from './staff-schedule.entity';

@Injectable()
export class StaffSchedulesService {
  constructor(
    @InjectRepository(StaffSchedule) private readonly schedules: Repository<StaffSchedule>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}

  private parseRange(start: string, end: string) {
    const startAt = new Date(start), endAt = new Date(end);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu.');
    }
    if (endAt.getTime() - startAt.getTime() > 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Một ca làm việc không được dài quá 24 giờ.');
    }
    return { startAt, endAt };
  }

  private async validateStaff(staffId: number) {
    const staff = await this.users.findOne({ where: { id: staffId, role: Role.STAFF, status: UserStatus.ACTIVE } });
    if (!staff) throw new BadRequestException('Nhân viên không tồn tại hoặc đã ngừng hoạt động.');
    return staff;
  }

  private async validateStation(stationId: number) {
    const station = await this.stations.findOne({ where: { id: stationId, isActive: true } });
    if (!station) throw new BadRequestException('Điểm thuê không tồn tại hoặc đã ngừng hoạt động.');
    return station;
  }

  private async ensureNoOverlap(staffId: number, startAt: Date, endAt: Date, exceptId?: number) {
    const query = this.schedules.createQueryBuilder('schedule')
      .where('schedule.staffId = :staffId', { staffId })
      .andWhere('schedule.status <> :cancelled', { cancelled: 'CANCELLED' })
      .andWhere('schedule.startAt < :endAt', { endAt })
      .andWhere('schedule.endAt > :startAt', { startAt });
    if (exceptId) query.andWhere('schedule.id <> :exceptId', { exceptId });
    if (await query.getOne()) throw new ConflictException('Nhân viên đã có ca làm việc trùng thời gian.');
  }

  async create(dto: CreateStaffScheduleDto, createdById: number) {
    const { startAt, endAt } = this.parseRange(dto.startAt, dto.endAt);
    await Promise.all([this.validateStaff(dto.staffId), this.validateStation(dto.stationId)]);
    await this.ensureNoOverlap(dto.staffId, startAt, endAt);
    const saved = await this.schedules.save(this.schedules.create({
      staffId: dto.staffId, stationId: dto.stationId, startAt, endAt,
      note: dto.note?.trim() || null, status: 'PLANNED', createdById,
    }));
    return this.findOne(saved.id);
  }

  async findOne(id: number) {
    const item = await this.schedules.findOne({ where: { id }, relations: { staff: true, station: true } });
    if (!item) throw new NotFoundException('Không tìm thấy lịch làm việc.');
    return item;
  }

  async list(filters: { from?: string; to?: string; staffId?: number; stationId?: number }) {
    const query = this.schedules.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.staff', 'staff')
      .leftJoinAndSelect('schedule.station', 'station')
      .orderBy('schedule.startAt', 'ASC');
    if (filters.from) query.andWhere('schedule.startAt >= :from', { from: new Date(filters.from + 'T00:00:00.000Z') });
    if (filters.to) query.andWhere('schedule.startAt < :to', { to: new Date(new Date(filters.to + 'T00:00:00.000Z').getTime() + 86400000) });
    if (filters.staffId) query.andWhere('schedule.staffId = :staffId', { staffId: filters.staffId });
    if (filters.stationId) query.andWhere('schedule.stationId = :stationId', { stationId: filters.stationId });
    return query.take(300).getMany();
  }

  async mine(staffId: number) {
    const now = new Date();
    const until = new Date(now.getTime() + 60 * 86400000);
    return this.schedules.find({
      where: { staffId, startAt: LessThan(until), endAt: MoreThan(now) },
      relations: { station: true },
      order: { startAt: 'ASC' },
      take: 100,
    });
  }

  async update(id: number, dto: UpdateStaffScheduleDto) {
    const item = await this.findOne(id);
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') {
      throw new BadRequestException('Không thể sửa ca đã hoàn tất hoặc đã hủy.');
    }
    const staffId = dto.staffId ?? item.staffId;
    const stationId = dto.stationId ?? item.stationId;
    const startAt = dto.startAt ? new Date(dto.startAt) : item.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : item.endAt;
    const range = this.parseRange(startAt.toISOString(), endAt.toISOString());
    await Promise.all([this.validateStaff(staffId), this.validateStation(stationId)]);
    if (item.status === 'IN_PROGRESS' && (staffId !== item.staffId || stationId !== item.stationId || range.startAt.getTime() !== item.startAt.getTime())) {
      throw new BadRequestException('Không thể đổi nhân viên, trạm hoặc giờ bắt đầu của ca đang diễn ra.');
    }
    await this.ensureNoOverlap(staffId, range.startAt, range.endAt, item.id);
    Object.assign(item, { staffId, stationId, ...range, note: dto.note === undefined ? item.note : dto.note?.trim() || null, status: dto.status ?? item.status });
    return this.schedules.save(item);
  }
}
