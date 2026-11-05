import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';
import { AuditService } from '../audit/audit.service';
import { CreateOperatingCostDto } from './operating-cost.dto';
import { OperatingCost, OperatingCostCategory } from './operating-cost.entity';

@Injectable()
export class OperatingCostsService {
  constructor(
    @InjectRepository(OperatingCost) private readonly costs: Repository<OperatingCost>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async create(user: JwtUser, dto: CreateOperatingCostDto) {
    const station = await this.stations.findOne({ where: { id: dto.stationId, isActive: true } });
    if (!station) throw new NotFoundException('Không tìm thấy trạm hoặc trạm đã ngừng hoạt động');
    if (user.role === Role.STAFF && user.stationId !== station.id) {
      throw new ForbiddenException('Không được ghi nhận chi phí ngoài trạm được phân công');
    }
    let vehicle: Vehicle | null = null;
    if (dto.vehicleId) {
      vehicle = await this.vehicles.findOne({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      if (vehicle.stationId !== station.id) throw new BadRequestException('Trạm ghi nhận phải trùng với trạm hiện tại của xe');
    }
    if (dto.category === OperatingCostCategory.CHARGING && !vehicle) {
      throw new BadRequestException('Chi phí sạc điện phải gắn với một xe cụ thể');
    }
    if ((dto.energyKwh !== undefined || dto.unitPrice !== undefined) && dto.category !== OperatingCostCategory.CHARGING) {
      throw new BadRequestException('Sản lượng điện và đơn giá chỉ áp dụng cho chi phí sạc');
    }
    const saved = await this.costs.save(this.costs.create({
      stationId: station.id, vehicleId: vehicle?.id ?? null, category: dto.category,
      amount: String(dto.amount), energyKwh: dto.energyKwh === undefined ? null : String(dto.energyKwh),
      unitPrice: dto.unitPrice === undefined ? null : String(dto.unitPrice),
      occurredAt: new Date(dto.occurredAt), note: dto.note?.trim() || null, recordedById: user.sub,
    }));
    await this.audit?.record(user.sub, 'OPERATING_COST_RECORDED', 'OPERATING_COST', saved.id, {
      stationId: saved.stationId, vehicleId: saved.vehicleId, category: saved.category, amount: saved.amount,
    });
    return saved;
  }

  async list(user: JwtUser, filters: { from?: string; to?: string; stationId?: number; vehicleId?: number; category?: OperatingCostCategory }) {
    const qb = this.costs.createQueryBuilder('cost')
      .leftJoinAndSelect('cost.station', 'station').leftJoinAndSelect('cost.vehicle', 'vehicle')
      .orderBy('cost.occurredAt', 'DESC').take(500);
    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Ngày kết thúc không hợp lệ');
    if (from && to && from > to) throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    if (from) qb.andWhere('cost.occurredAt >= :from', { from });
    if (to) qb.andWhere('cost.occurredAt <= :to', { to });
    if (filters.category) qb.andWhere('cost.category = :category', { category: filters.category });
    if (filters.vehicleId) qb.andWhere('cost.vehicleId = :vehicleId', { vehicleId: filters.vehicleId });
    if (filters.stationId) qb.andWhere('cost.stationId = :stationId', { stationId: filters.stationId });
    if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.andWhere('cost.stationId = :staffStationId', { staffStationId: user.stationId });
    }
    return qb.getMany();
  }
}
