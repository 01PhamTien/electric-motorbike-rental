import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Station } from '../stations/station.entity';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }
  listCustomers() {
    return this.repo.find({ where: { role: Role.CUSTOMER }, order: { id: 'DESC' } });
  }

  async updateCustomerStatus(id: number, status: UserStatus) {
    const customer = await this.repo.findOneBy({ id, role: Role.CUSTOMER });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    if (customer.status !== status) {
      customer.status = status;
      await this.repo.save(customer);
    }
    return this.repo.findOneByOrFail({ id: customer.id });
  }

  async updateMyProfile(id: number, fullName: string, phone: string | null) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const cleanName = fullName.trim();
    if (cleanName.length < 2) throw new BadRequestException('Họ tên phải có ít nhất 2 ký tự');
    const cleanPhone = phone?.trim() || null;
    await this.validateUnique(user.email, cleanPhone, user.id);
    user.fullName = cleanName;
    user.phone = cleanPhone;
    await this.repo.save(user);
    return this.findById(id);
  }

  listStaff() {
    return this.repo.find({ where: { role: Role.STAFF }, relations: { station: true }, order: { id: 'DESC' } });
  }

  async findStaff(id: number) {
    const staff = await this.repo.findOne({ where: { id, role: Role.STAFF }, relations: { station: true } });
    if (!staff) throw new NotFoundException('Không tìm thấy nhân viên');
    return staff;
  }

  private async validateStation(id: number) {
    const station = await this.stations.findOneBy({ id, isActive: true });
    if (!station) throw new BadRequestException('Điểm thuê không tồn tại hoặc đã ngừng hoạt động');
    return station;
  }

  private async validateUnique(email: string, phone: string | null, exceptId?: number) {
    const existingEmail = await this.repo.findOneBy({ email });
    if (existingEmail && existingEmail.id !== exceptId) throw new ConflictException('Email đã được sử dụng');
    if (phone) {
      const existingPhone = await this.repo.findOneBy({ phone });
      if (existingPhone && existingPhone.id !== exceptId) throw new ConflictException('Số điện thoại đã được sử dụng');
    }
  }

  async createStaff(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;
    const fullName = dto.fullName.trim();
    if (fullName.length < 2) throw new BadRequestException('Tên nhân viên không hợp lệ');
    await this.validateUnique(email, phone);
    const station = await this.validateStation(dto.stationId);
    const staff = await this.repo.save(this.repo.create({
      fullName, email, phone, stationId: station.id,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: Role.STAFF, status: UserStatus.ACTIVE,
    }));
    return this.findStaff(staff.id);
  }

  async updateStaff(id: number, dto: UpdateStaffDto) {
    const staff = await this.findStaff(id);
    const email = dto.email === undefined ? staff.email : dto.email.trim().toLowerCase();
    const phone = dto.phone === undefined ? staff.phone : dto.phone?.trim() || null;
    const fullName = dto.fullName === undefined ? staff.fullName : dto.fullName.trim();
    if (fullName.length < 2) throw new BadRequestException('Tên nhân viên không hợp lệ');
    await this.validateUnique(email, phone, staff.id);
    if (dto.stationId !== undefined) {
      const station = await this.validateStation(dto.stationId);
      staff.stationId = station.id;
    }
    staff.email = email; staff.phone = phone; staff.fullName = fullName;
    await this.repo.save(staff);
    return this.findStaff(staff.id);
  }

  async changeMyPassword(id: number, currentPassword: string, newPassword: string) {
    const user = await this.repo.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    if (currentPassword === newPassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.repo.save(user);
    return { success: true };
  }

  async resetStaffPassword(id: number, newPassword: string) {
    const staff = await this.findStaff(id);
    await this.repo.update({ id: staff.id, role: Role.STAFF }, {
      passwordHash: await bcrypt.hash(newPassword, 12),
    });
    return { success: true };
  }

  async updateStaffStatus(id: number, status: UserStatus) {
    const staff = await this.findStaff(id);
    if (staff.status !== status) {
      staff.status = status;
      await this.repo.save(staff);
    }
    return this.findStaff(id);
  }

}
