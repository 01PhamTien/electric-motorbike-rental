import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Voucher, VoucherDiscountType } from './voucher.entity';
import { VoucherRedemption } from './voucher-redemption.entity';
import { CreateVoucherDto, UpdateVoucherDto } from './dto';

@Injectable()
export class VouchersService {
  constructor(@InjectRepository(Voucher) private readonly repo: Repository<Voucher>,
    @InjectRepository(VoucherRedemption) private readonly redemptions: Repository<VoucherRedemption>) {}

  private normalize(code: string) { return code.trim().toUpperCase(); }
  private validateDates(startsAt: Date, endsAt: Date) {
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)
      throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
  }
  async create(dto: CreateVoucherDto) {
    const code = this.normalize(dto.code);
    if (await this.repo.findOneBy({ code })) throw new ConflictException('Mã voucher đã tồn tại');
    if (dto.discountType === VoucherDiscountType.PERCENT && dto.discountValue > 100)
      throw new BadRequestException('Voucher phần trăm không được vượt quá 100%');
    const startsAt = new Date(dto.startsAt), endsAt = new Date(dto.endsAt);
    this.validateDates(startsAt, endsAt);
    if (dto.usageLimit != null && dto.usageLimit < 1) throw new BadRequestException('Giới hạn lượt dùng không hợp lệ');
    return this.repo.save(this.repo.create({ ...dto, code, startsAt, endsAt,
      maxDiscountAmount: dto.maxDiscountAmount == null ? null : dto.maxDiscountAmount.toFixed(2),
      minRentalAmount: dto.minRentalAmount.toFixed(2), discountValue: dto.discountValue.toFixed(2),
      usageLimit: dto.usageLimit ?? null, perCustomerLimit: dto.perCustomerLimit,
      usageCount: 0, isActive: dto.isActive ?? true, description: dto.description?.trim() || null }));
  }
  async list() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
  async findOne(id: number) {
    const voucher = await this.repo.findOneBy({ id });
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher');
    return voucher;
  }
  async update(id: number, dto: UpdateVoucherDto) {
    const voucher = await this.findOne(id);
    const code = dto.code == null ? voucher.code : this.normalize(dto.code);
    if (code !== voucher.code && await this.repo.findOneBy({ code })) throw new ConflictException('Mã voucher đã tồn tại');
    const type = dto.discountType ?? voucher.discountType;
    const value = dto.discountValue ?? Number(voucher.discountValue);
    if (type === VoucherDiscountType.PERCENT && value > 100) throw new BadRequestException('Voucher phần trăm không được vượt quá 100%');
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : voucher.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : voucher.endsAt;
    this.validateDates(startsAt, endsAt);
    if (dto.usageLimit != null && dto.usageLimit < voucher.usageCount)
      throw new BadRequestException('Giới hạn lượt dùng không thể thấp hơn số lượt đã sử dụng');
    Object.assign(voucher, dto, { code, discountType: type, discountValue: value.toFixed(2), startsAt, endsAt,
      maxDiscountAmount: dto.maxDiscountAmount === undefined ? voucher.maxDiscountAmount : dto.maxDiscountAmount.toFixed(2),
      minRentalAmount: (dto.minRentalAmount ?? Number(voucher.minRentalAmount)).toFixed(2),
      usageLimit: dto.usageLimit === undefined ? voucher.usageLimit : dto.usageLimit,
      description: dto.description === undefined ? voucher.description : dto.description?.trim() || null });
    return this.repo.save(voucher);
  }
  async usage(id: number) {
    await this.findOne(id);
    return this.redemptions.find({ where: { voucherId: id }, order: { createdAt: 'DESC' }, take: 200 });
  }
}
