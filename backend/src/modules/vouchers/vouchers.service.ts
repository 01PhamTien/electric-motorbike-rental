import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

  private calculate(voucher: Voucher, rentalAmount: number) {
    const cents = (value: number | string) => Math.round(Number(value) * 100);
    const base = cents(rentalAmount);
    let discount = voucher.discountType === VoucherDiscountType.PERCENT
      ? Math.floor(base * Number(voucher.discountValue) / 10000)
      : cents(voucher.discountValue);
    if (voucher.maxDiscountAmount != null) discount = Math.min(discount, cents(voucher.maxDiscountAmount));
    discount = Math.min(base, discount);
    if (discount <= 0) throw new BadRequestException('Voucher không tạo ra mức giảm hợp lệ');
    return { discountAmount: (discount / 100).toFixed(2), finalRentalAmount: ((base - discount) / 100).toFixed(2) };
  }

  private async assertUsable(voucher: Voucher, customerId: number, rentalAmount: number, manager?: EntityManager) {
    const now = new Date();
    if (!voucher.isActive) throw new BadRequestException('Voucher đã bị tạm ngưng');
    if (now < voucher.startsAt || now > voucher.endsAt) throw new BadRequestException('Voucher chưa đến thời gian áp dụng hoặc đã hết hạn');
    if (voucher.usageLimit != null && voucher.usageCount >= voucher.usageLimit) throw new BadRequestException('Voucher đã hết lượt sử dụng');
    if (rentalAmount < Number(voucher.minRentalAmount)) throw new BadRequestException('Đơn thuê chưa đạt giá trị tối thiểu của voucher');
    const redemptionRepo = manager ? manager.getRepository(VoucherRedemption) : this.redemptions;
    const used = await redemptionRepo.count({ where: { voucherId: voucher.id, customerId } });
    if (used >= voucher.perCustomerLimit) throw new BadRequestException('Bạn đã sử dụng hết lượt của voucher này');
    return this.calculate(voucher, rentalAmount);
  }

  async preview(customerId: number, codeInput: string, rentalAmount: number) {
    if (!codeInput?.trim() || !Number.isFinite(rentalAmount) || rentalAmount <= 0)
      throw new BadRequestException('Vui lòng nhập mã voucher và giá trị tiền thuê hợp lệ');
    const voucher = await this.repo.findOneBy({ code: this.normalize(codeInput) });
    if (!voucher) throw new NotFoundException('Mã voucher không tồn tại');
    const amounts = await this.assertUsable(voucher, customerId, rentalAmount);
    return { code: voucher.code, discountType: voucher.discountType, discountValue: voucher.discountValue,
      baseRentalAmount: rentalAmount.toFixed(2), ...amounts };
  }

  async redeem(manager: EntityManager, customerId: number, bookingId: number, codeInput: string, rentalAmount: number) {
    const voucherRepo = manager.getRepository(Voucher);
    const voucher = await voucherRepo.findOne({ where: { code: this.normalize(codeInput) }, lock: { mode: 'pessimistic_write' } });
    if (!voucher) throw new NotFoundException('Mã voucher không tồn tại');
    const amounts = await this.assertUsable(voucher, customerId, rentalAmount, manager);
    voucher.usageCount += 1;
    await voucherRepo.save(voucher);
    await manager.getRepository(VoucherRedemption).save({
      voucherId: voucher.id, bookingId, customerId, discountAmount: amounts.discountAmount,
    });
    return { voucherId: voucher.id, voucherCode: voucher.code, ...amounts };
  }

  async usage(id: number) {
    await this.findOne(id);
    return this.redemptions.find({ where: { voucherId: id }, order: { createdAt: 'DESC' }, take: 200 });
  }
}
