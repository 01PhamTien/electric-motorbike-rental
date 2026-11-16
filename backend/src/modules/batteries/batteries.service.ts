import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Battery, BatteryStatus } from './battery.entity';
import { BatterySwap } from './battery-swap.entity';
import { BatteryReservation, BatteryReservationStatus } from './battery-reservation.entity';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { CreateBatteryReservationDto, RedeemBatteryReservationDto } from './batteries.dto';
import { CreateBatteryDto, InstallBatteryDto, SwapBatteryDto } from './batteries.dto';

@Injectable()
export class BatteriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatteriesService.name);
  private expiryTimer?: NodeJS.Timeout;
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Battery) private readonly batteries: Repository<Battery>,
    @InjectRepository(BatterySwap) private readonly swaps: Repository<BatterySwap>,
    @InjectRepository(BatteryReservation) private readonly reservations: Repository<BatteryReservation>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Optional() private readonly audit?: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.BATTERY_RESERVATION_EXPIRY_ENABLED === 'false') return;
    this.reservationTtlMinutes();
    const intervalMs = Number(process.env.BATTERY_RESERVATION_EXPIRY_INTERVAL_MS ?? 60_000);
    if (!Number.isInteger(intervalMs) || intervalMs < 5_000) {
      throw new Error('BATTERY_RESERVATION_EXPIRY_INTERVAL_MS must be an integer >= 5000');
    }
    this.expiryTimer = setInterval(() => {
      void this.expireReservations().catch(error => {
        this.logger.error('Failed to expire battery reservations', error instanceof Error ? error.stack : String(error));
      });
    }, intervalMs);
    this.expiryTimer.unref?.();
    void this.expireReservations().catch(error => {
      this.logger.error('Initial battery reservation expiry failed', error instanceof Error ? error.stack : String(error));
    });
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  /** Marks elapsed holds as EXPIRED. Safe to call repeatedly and from lazy-read paths. */
  async expireReservations(now = new Date()) {
    const result = await this.reservations.createQueryBuilder()
      .update(BatteryReservation)
      .set({ status: BatteryReservationStatus.EXPIRED })
      .where('status = :status AND expiresAt <= :now', {
        status: BatteryReservationStatus.RESERVED,
        now,
      })
      .execute();
    return result.affected ?? 0;
  }

  private reservationTtlMinutes() {
    const minutes = Number(process.env.BATTERY_RESERVATION_TTL_MINUTES ?? 10);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      throw new Error('BATTERY_RESERVATION_TTL_MINUTES must be an integer between 1 and 120');
    }
    return minutes;
  }

  private assertStation(user: JwtUser, stationId: number) {
    if (user.role === Role.STAFF && user.stationId !== stationId) throw new ForbiddenException('Không được thao tác pin ngoài trạm được phân công');
  }

  async create(user: JwtUser, dto: CreateBatteryDto) {
    this.assertStation(user, dto.stationId);
    const station = await this.stations.findOne({ where: { id: dto.stationId, isActive: true } });
    if (!station) throw new NotFoundException('Không tìm thấy trạm hoặc trạm đã ngừng hoạt động');
    const duplicate = await this.batteries.findOne({ where: { serialNumber: dto.serialNumber.trim() } });
    if (duplicate) throw new ConflictException('Mã serial pin đã tồn tại');
    const battery = await this.batteries.save(this.batteries.create({
      serialNumber: dto.serialNumber.trim(), stationId: station.id, vehicleId: null,
      status: BatteryStatus.FULL, capacityKwh: dto.capacityKwh == null ? null : String(dto.capacityKwh),
      healthPercent: dto.healthPercent ?? 100, cycleCount: 0, lastChargedAt: null, note: dto.note?.trim() || null,
    }));
    await this.audit?.record(user.sub, 'BATTERY_CREATED', 'BATTERY', battery.id, { stationId: battery.stationId, serialNumber: battery.serialNumber });
    return battery;
  }

  async list(user: JwtUser, stationId?: number, status?: BatteryStatus) {
    if (stationId != null) this.assertStation(user, stationId);
    if (user.role === Role.STAFF && user.stationId == null) return [];
    const effectiveStationId = stationId ?? (user.role === Role.STAFF ? user.stationId : undefined);
    const qb = this.batteries.createQueryBuilder('battery').leftJoinAndSelect('battery.station','station')
      .leftJoinAndSelect('battery.vehicle','vehicle').orderBy('battery.updatedAt','DESC').take(500);
    if (effectiveStationId != null) qb.andWhere('battery.stationId = :stationId',{stationId:effectiveStationId});
    if (status) qb.andWhere('battery.status = :status',{status});
    return qb.getMany();
  }

  async inventory(user: JwtUser, filters: { stationId?: number; status?: BatteryStatus; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.floor(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit || 20)));
    if (filters.stationId != null) this.assertStation(user, filters.stationId);
    if (user.role === Role.STAFF && user.stationId == null) return { items: [], total: 0, page, limit, totalPages: 0 };
    const effectiveStationId = filters.stationId ?? (user.role === Role.STAFF ? user.stationId : undefined);
    const qb = this.batteries.createQueryBuilder('battery')
      .leftJoinAndSelect('battery.station', 'station')
      .leftJoinAndSelect('battery.vehicle', 'vehicle')
      .orderBy('battery.updatedAt', 'DESC')
      .addOrderBy('battery.id', 'DESC');
    if (effectiveStationId != null) qb.andWhere('battery.stationId = :stationId', { stationId: effectiveStationId });
    if (filters.status) qb.andWhere('battery.status = :status', { status: filters.status });
    if (filters.search?.trim()) {
      const search = filters.search.trim().slice(0, 80);
      qb.andWhere('(battery.serialNumber LIKE :search OR vehicle.code LIKE :search OR vehicle.licensePlate LIKE :search)', { search: `%${search}%` });
    }
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async inventorySummary(user: JwtUser, stationId?: number) {
    if (stationId != null) this.assertStation(user, stationId);
    if (user.role === Role.STAFF && user.stationId == null) return { totals: this.emptyInventoryTotals(), stations: [] };
    const effectiveStationId = stationId ?? (user.role === Role.STAFF ? user.stationId : undefined);
    const qb = this.batteries.createQueryBuilder('battery')
      .innerJoin('battery.station', 'station')
      .select('battery.stationId', 'stationId')
      .addSelect('station.name', 'stationName')
      .addSelect('battery.status', 'status')
      .addSelect('COUNT(battery.id)', 'count')
      .groupBy('battery.stationId')
      .addGroupBy('station.name')
      .addGroupBy('battery.status')
      .orderBy('station.name', 'ASC');
    if (effectiveStationId != null) qb.andWhere('battery.stationId = :stationId', { stationId: effectiveStationId });
    const rows = await qb.getRawMany<{ stationId: string | number; stationName: string; status: BatteryStatus; count: string | number }>();
    const stations = new Map<number, { stationId: number; stationName: string; total: number; FULL: number; INSTALLED: number; CHARGING: number; MAINTENANCE: number; RETIRED: number; TRANSFERRING: number }>();
    const totals = this.emptyInventoryTotals();
    for (const row of rows) {
      const id = Number(row.stationId);
      if (!stations.has(id)) stations.set(id, { stationId: id, stationName: row.stationName, ...this.emptyInventoryTotals() });
      const count = Number(row.count);
      const station = stations.get(id)!;
      station[row.status] += count;
      station.total += count;
      totals[row.status] += count;
      totals.total += count;
    }
    return { totals, stations: Array.from(stations.values()) };
  }

  private emptyInventoryTotals() {
    return { total: 0, FULL: 0, INSTALLED: 0, CHARGING: 0, MAINTENANCE: 0, RETIRED: 0, TRANSFERRING: 0 };
  }

  async install(user: JwtUser, dto: InstallBatteryDto) {
    return this.dataSource.transaction(async manager => {
      const batteryRepo=manager.getRepository(Battery), vehicleRepo=manager.getRepository(Vehicle);
      const stationRepo=manager.getRepository(Station),reservationRepo=manager.getRepository(BatteryReservation);
      const hint=await vehicleRepo.findOne({where:{id:dto.vehicleId}});
      if(!hint) throw new NotFoundException('Không tìm thấy xe');
      await stationRepo.findOne({where:{id:hint.stationId},lock:{mode:'pessimistic_write'}});
      const vehicle=await vehicleRepo.findOne({where:{id:dto.vehicleId},lock:{mode:'pessimistic_write'}});
      if(!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user,vehicle.stationId);
      if(!vehicle.isActive) throw new BadRequestException('Không thể lắp pin cho xe đã ngừng hoạt động');
      const battery=await batteryRepo.findOne({where:{id:dto.batteryId},lock:{mode:'pessimistic_write'}});
      if(!battery) throw new NotFoundException('Không tìm thấy pin');
      if(battery.status!==BatteryStatus.FULL||battery.vehicleId!==null) throw new BadRequestException('Chỉ có thể lắp pin đầy đang ở kho trạm');
      const fullCount=await batteryRepo.count({where:{stationId:vehicle.stationId,status:BatteryStatus.FULL,vehicleId:IsNull()}});
      const heldCount=await reservationRepo.createQueryBuilder('r').where('r.stationId = :stationId',{stationId:vehicle.stationId})
        .andWhere('r.status = :status',{status:BatteryReservationStatus.RESERVED}).andWhere('r.expiresAt > :now',{now:new Date()}).getCount();
      if(fullCount-heldCount<=0) throw new ConflictException('Pin này đang được giữ trước cho khách. Không thể sử dụng cho thao tác khác.');
      if(battery.stationId!==vehicle.stationId) throw new BadRequestException('Pin và xe phải thuộc cùng một trạm');
      const installed=await batteryRepo.findOne({where:{vehicleId:vehicle.id,status:BatteryStatus.INSTALLED}});
      if(installed) throw new ConflictException('Xe đã có pin được lắp. Hãy dùng nghiệp vụ đổi pin.');
      battery.status=BatteryStatus.INSTALLED;battery.vehicleId=vehicle.id;
      const saved=await batteryRepo.save(battery);
      await this.audit?.record(user.sub,'BATTERY_INSTALLED','BATTERY',saved.id,{vehicleId:vehicle.id});
      return saved;
    });
  }

  async swap(user: JwtUser, dto: SwapBatteryDto) {
    const result=await this.dataSource.transaction(async manager=>{
      const batteryRepo=manager.getRepository(Battery),vehicleRepo=manager.getRepository(Vehicle),swapRepo=manager.getRepository(BatterySwap);
      const stationRepo=manager.getRepository(Station),reservationRepo=manager.getRepository(BatteryReservation);
      const hint=await vehicleRepo.findOne({where:{id:dto.vehicleId}});
      if(!hint) throw new NotFoundException('Không tìm thấy xe');
      await stationRepo.findOne({where:{id:hint.stationId},lock:{mode:'pessimistic_write'}});
      const vehicle=await vehicleRepo.findOne({where:{id:dto.vehicleId},lock:{mode:'pessimistic_write'}});
      if(!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user,vehicle.stationId);
      if(!vehicle.isActive) throw new BadRequestException('Xe đã ngừng hoạt động, không thể đổi pin');
      const replacement=await batteryRepo.findOne({where:{id:dto.replacementBatteryId},lock:{mode:'pessimistic_write'}});
      if(!replacement) throw new NotFoundException('Không tìm thấy pin thay thế');
      if(replacement.status!==BatteryStatus.FULL||replacement.vehicleId!==null) throw new BadRequestException('Pin thay thế phải ở trạng thái đầy và sẵn sàng');
      const fullCount=await batteryRepo.count({where:{stationId:vehicle.stationId,status:BatteryStatus.FULL,vehicleId:IsNull()}});
      const heldCount=await reservationRepo.createQueryBuilder('r').where('r.stationId = :stationId',{stationId:vehicle.stationId})
        .andWhere('r.status = :status',{status:BatteryReservationStatus.RESERVED}).andWhere('r.expiresAt > :now',{now:new Date()}).getCount();
      if(fullCount-heldCount<=0) throw new ConflictException('Pin dự phòng đang được giữ trước cho khách. Hãy chọn pin chưa được giữ.');
      if(replacement.stationId!==vehicle.stationId) throw new BadRequestException('Pin thay thế phải có sẵn tại trạm hiện tại của xe');
      const removed=await batteryRepo.findOne({where:{vehicleId:vehicle.id,status:BatteryStatus.INSTALLED},lock:{mode:'pessimistic_write'}});
      if(!removed) throw new BadRequestException('Xe chưa có pin được ghi nhận trong hệ thống');
      if(removed.stationId!==vehicle.stationId) throw new BadRequestException('Pin đang lắp trên xe không thuộc trạm hiện tại; cần kiểm kê trước khi đổi');
      removed.status=BatteryStatus.CHARGING;removed.vehicleId=null;
      replacement.status=BatteryStatus.INSTALLED;replacement.vehicleId=vehicle.id;
      await batteryRepo.save(removed);await batteryRepo.save(replacement);
      const swap=await swapRepo.save(swapRepo.create({
        vehicleId:vehicle.id,stationId:vehicle.stationId,removedBatteryId:removed.id,
        installedBatteryId:replacement.id,performedById:user.sub,note:dto.note?.trim()||null,
      }));
      return {swap,removedBattery:removed,installedBattery:replacement,vehicleCode:vehicle.code};
    });
    await this.audit?.record(user.sub,'BATTERY_SWAPPED','BATTERY_SWAP',result.swap.id,{
      vehicleId:result.swap.vehicleId,removedBatteryId:result.removedBattery.id,installedBatteryId:result.installedBattery.id,
    });
    return result;
  }

  async completeCharging(user: JwtUser, batteryId: number) {
    const battery=await this.batteries.findOne({where:{id:batteryId}});
    if(!battery) throw new NotFoundException('Không tìm thấy pin');
    this.assertStation(user,battery.stationId);
    if(battery.status!==BatteryStatus.CHARGING||battery.vehicleId!==null) throw new BadRequestException('Chỉ có thể hoàn tất sạc cho pin đang sạc');
    battery.status=BatteryStatus.FULL;battery.lastChargedAt=new Date();battery.cycleCount+=1;
    const saved=await this.batteries.save(battery);
    await this.audit?.record(user.sub,'BATTERY_CHARGED','BATTERY',saved.id,{cycleCount:saved.cycleCount});
    return saved;
  }


  async reserve(user:JwtUser,dto:CreateBatteryReservationDto) {
    const reservation=await this.dataSource.transaction(async manager=>{
      const stationRepo=manager.getRepository(Station),bookingRepo=manager.getRepository(Booking),userRepo=manager.getRepository(User),vehicleRepo=manager.getRepository(Vehicle);
      const customer=await userRepo.findOne({where:{id:user.sub},lock:{mode:'pessimistic_write'}});
      if(!customer) throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
      const batteryRepo=manager.getRepository(Battery),reservationRepo=manager.getRepository(BatteryReservation);
      const station=await stationRepo.findOne({where:{id:dto.stationId,isActive:true},lock:{mode:'pessimistic_write'}});
      if(!station) throw new NotFoundException('Trạm đổi pin không tồn tại hoặc đã ngừng hoạt động');
      // Match the booking lifecycle lock order (vehicle first, then booking)
      // to avoid deadlocks with concurrent return/transfer operations.
      const bookingHint=await bookingRepo.findOne({where:{id:dto.bookingId,customerId:user.sub}});
      if(!bookingHint) throw new NotFoundException('Không tìm thấy đơn thuê của bạn');
      const vehicle=await vehicleRepo.findOne({where:{id:bookingHint.vehicleId},lock:{mode:'pessimistic_write'}});
      if(!vehicle||!vehicle.isActive||vehicle.stationId!==station.id) throw new BadRequestException('Xe thuê hiện không ở trạm này. Vui lòng chọn trạm hiện tại của xe.');
      const booking=await bookingRepo.findOne({where:{id:dto.bookingId,customerId:user.sub},lock:{mode:'pessimistic_write'}});
      if(!booking) throw new NotFoundException('Không tìm thấy đơn thuê của bạn');
      if(booking.vehicleId!==vehicle.id) throw new ConflictException('Xe trong đơn thuê đã thay đổi. Vui lòng tải lại thông tin.');
      if(booking.status!==BookingStatus.RENTING) throw new BadRequestException('Chỉ đơn thuê đang sử dụng xe mới được đặt trước pin');
      const now=new Date();
      // Lazy expiry for both this station and this customer. The station row lock
      // serializes competing holds for the last available battery at this station.
      await reservationRepo.createQueryBuilder().update(BatteryReservation)
        .set({status:BatteryReservationStatus.EXPIRED})
        .where('status = :status AND expiresAt <= :now AND (stationId = :stationId OR customerId = :customerId)', {
          status:BatteryReservationStatus.RESERVED, now, stationId:station.id, customerId:user.sub,
        }).execute();
      const existing=await reservationRepo.findOne({
        where:{customerId:user.sub,status:BatteryReservationStatus.RESERVED},
      });
      if(existing) throw new ConflictException('Bạn đang có một lượt giữ pin. Hãy sử dụng hoặc hủy lượt giữ hiện tại trước.');
      const available=await batteryRepo.count({where:{stationId:station.id,status:BatteryStatus.FULL,vehicleId:IsNull()}});
      const held=await reservationRepo.createQueryBuilder('r').where('r.stationId = :stationId',{stationId:station.id})
        .andWhere('r.status = :status',{status:BatteryReservationStatus.RESERVED})
        .andWhere('r.expiresAt > :now',{now}).getCount();
      if(available-held<=0) throw new ConflictException('Trạm hiện đã hết pin có thể giữ trước. Vui lòng chọn trạm khác.');
      return reservationRepo.save(reservationRepo.create({
        customerId:user.sub,stationId:station.id,bookingId:booking.id,vehicleId:booking.vehicleId,
        status:BatteryReservationStatus.RESERVED,expiresAt:new Date(now.getTime()+this.reservationTtlMinutes()*60_000),
        redeemedAt:null,cancelledAt:null,redeemedById:null,batterySwapId:null,
      }));
    });
    await this.audit?.record(user.sub,'BATTERY_RESERVED','BATTERY_RESERVATION',reservation.id,{stationId:reservation.stationId,bookingId:reservation.bookingId,expiresAt:reservation.expiresAt});
    return reservation;
  }

  async myReservations(user:JwtUser) {
    await this.expireReservations();
    return this.reservations.find({where:{customerId:user.sub},relations:{station:true,vehicle:true},order:{createdAt:'DESC'},take:50});
  }

  async listReservations(user:JwtUser,stationId?:number) {
    if (stationId != null) this.assertStation(user, stationId);
    if (user.role === Role.STAFF && user.stationId == null) return [];
    await this.expireReservations();
    const effectiveStationId = stationId ?? (user.role === Role.STAFF ? user.stationId : undefined);
    const qb=this.reservations.createQueryBuilder('r').leftJoinAndSelect('r.station','station')
      .leftJoinAndSelect('r.vehicle','vehicle').leftJoinAndSelect('r.booking','booking')
      .orderBy('r.createdAt','DESC').take(200);
    if(effectiveStationId != null) qb.andWhere('r.stationId = :stationId',{stationId:effectiveStationId});
    return qb.getMany();
  }

  async cancelReservation(user:JwtUser,id:number) {
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryReservation);
      const reservation=await repo.findOne({where:{id},lock:{mode:'pessimistic_write'}});
      if(!reservation) throw new NotFoundException('Không tìm thấy lượt giữ pin');
      if(reservation.customerId!==user.sub) throw new ForbiddenException('Bạn không có quyền hủy lượt giữ pin này');
      if(reservation.status!==BatteryReservationStatus.RESERVED) throw new BadRequestException('Lượt giữ pin này không còn hiệu lực');
      const expired=reservation.expiresAt<=new Date();
      reservation.status=expired?BatteryReservationStatus.EXPIRED:BatteryReservationStatus.CANCELLED;
      reservation.cancelledAt=expired?null:new Date();
      return repo.save(reservation);
    });
    await this.audit?.record(user.sub,
      result.status===BatteryReservationStatus.EXPIRED?'BATTERY_RESERVATION_EXPIRED':'BATTERY_RESERVATION_CANCELLED',
      'BATTERY_RESERVATION',id);
    return result;
  }

  async redeemReservation(user:JwtUser,id:number,dto:RedeemBatteryReservationDto) {
    const result=await this.dataSource.transaction(async manager=>{
      const reservationRepo=manager.getRepository(BatteryReservation),batteryRepo=manager.getRepository(Battery);
      const vehicleRepo=manager.getRepository(Vehicle),swapRepo=manager.getRepository(BatterySwap),stationRepo=manager.getRepository(Station);
      const reservationHint=await reservationRepo.findOne({where:{id}});
      if(!reservationHint) throw new NotFoundException('Không tìm thấy lượt giữ pin');
      await stationRepo.findOne({where:{id:reservationHint.stationId},lock:{mode:'pessimistic_write'}});
      const reservation=await reservationRepo.findOne({where:{id},lock:{mode:'pessimistic_write'}});
      if(!reservation) throw new NotFoundException('Không tìm thấy lượt giữ pin');
      this.assertStation(user,reservation.stationId);
      if(reservation.status!==BatteryReservationStatus.RESERVED) throw new BadRequestException('Lượt giữ pin không còn hiệu lực');
      if(reservation.expiresAt<=new Date()){
        reservation.status=BatteryReservationStatus.EXPIRED;
        await reservationRepo.save(reservation);
        return {expired:true as const};
      }
      const vehicle=await vehicleRepo.findOne({where:{id:reservation.vehicleId},lock:{mode:'pessimistic_write'}});
      if(!vehicle||vehicle.stationId!==reservation.stationId||!vehicle.isActive) throw new BadRequestException('Xe thuê không còn ở trạm giữ pin');
      const replacement=await batteryRepo.findOne({where:{id:dto.replacementBatteryId},lock:{mode:'pessimistic_write'}});
      if(!replacement||replacement.status!==BatteryStatus.FULL||replacement.vehicleId!==null||replacement.stationId!==reservation.stationId)
        throw new BadRequestException('Pin thay thế không còn sẵn sàng tại trạm này');
      const removed=await batteryRepo.findOne({where:{vehicleId:vehicle.id,status:BatteryStatus.INSTALLED},lock:{mode:'pessimistic_write'}});
      if(!removed||removed.stationId!==reservation.stationId) throw new BadRequestException('Không tìm thấy pin hợp lệ đang lắp trên xe');
      removed.status=BatteryStatus.CHARGING;removed.vehicleId=null;
      replacement.status=BatteryStatus.INSTALLED;replacement.vehicleId=vehicle.id;
      await batteryRepo.save(removed);await batteryRepo.save(replacement);
      const swap=await swapRepo.save(swapRepo.create({
        vehicleId:vehicle.id,stationId:reservation.stationId,removedBatteryId:removed.id,
        installedBatteryId:replacement.id,performedById:user.sub,note:dto.note?.trim()||'Đổi pin theo lượt giữ trước #'+reservation.id,
      }));
      reservation.status=BatteryReservationStatus.REDEEMED;reservation.redeemedAt=new Date();
      reservation.redeemedById=user.sub;reservation.batterySwapId=swap.id;
      await reservationRepo.save(reservation);
      return {expired:false as const,reservation,swap,removedBattery:removed,installedBattery:replacement};
    });
    if(result.expired) throw new BadRequestException('Lượt giữ pin đã hết hạn. Vui lòng tạo lượt giữ mới.');
    await this.audit?.record(user.sub,'BATTERY_RESERVATION_REDEEMED','BATTERY_RESERVATION',id,{swapId:result.swap.id,vehicleId:result.swap.vehicleId});
    return result;
  }

  async publicAvailability() {
    await this.expireReservations();
    // Start from active stations so an empty station is returned with a
    // count of zero instead of disappearing from the public availability list.
    const rows=await this.stations.createQueryBuilder('station')
      .leftJoin(Battery,'battery',
        'battery.stationId = station.id AND battery.status = :status AND battery.vehicleId IS NULL',
        {status:BatteryStatus.FULL})
      .select('station.id','stationId')
      .addSelect('COUNT(battery.id)','availableBatteryCount')
      .where('station.isActive = :isActive',{isActive:true})
      .groupBy('station.id')
      .getRawMany();
    const now=new Date();
    const holds=await this.reservations.createQueryBuilder('r').select('r.stationId','stationId')
      .addSelect('COUNT(*)','heldCount').where('r.status = :status',{status:BatteryReservationStatus.RESERVED})
      .andWhere('r.expiresAt > :now',{now}).groupBy('r.stationId').getRawMany();
    const heldByStation=new Map(holds.map((r:{stationId:string|number;heldCount:string|number})=>[Number(r.stationId),Number(r.heldCount)]));
    return rows.map((row:{stationId:string|number;availableBatteryCount:string|number})=>{
      const stationId=Number(row.stationId),availableBatteryCount=Math.max(0,Number(row.availableBatteryCount)-(heldByStation.get(stationId)??0));
      return {stationId,availableBatteryCount,supportsBatterySwap:availableBatteryCount>0};
    });
  }

  async history(user: JwtUser, filters: {
    stationId?: number; vehicleId?: number; serial?: string; from?: string; to?: string; page?: number; limit?: number;
  }) {
    const page = Math.max(1, Math.floor(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit || 20)));
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc');
    }
    const qb = this.swaps.createQueryBuilder('swap')
      .leftJoinAndSelect('swap.vehicle', 'vehicle')
      .leftJoinAndSelect('swap.station', 'station')
      .leftJoinAndSelect('swap.removedBattery', 'removedBattery')
      .leftJoinAndSelect('swap.installedBattery', 'installedBattery')
      .leftJoin('swap.performedBy', 'performedBy')
      .addSelect(['performedBy.id', 'performedBy.fullName'])
      .orderBy('swap.createdAt', 'DESC')
      .addOrderBy('swap.id', 'DESC');

    if (filters.stationId != null) {
      this.assertStation(user, filters.stationId);
      qb.andWhere('swap.stationId = :stationId', { stationId: filters.stationId });
    } else if (user.role === Role.STAFF) {
      if (user.stationId == null) return { items: [], total: 0, page, limit, totalPages: 0 };
      qb.andWhere('swap.stationId = :stationId', { stationId: user.stationId });
    }
    if (filters.vehicleId != null) qb.andWhere('swap.vehicleId = :vehicleId', { vehicleId: filters.vehicleId });
    if (filters.from) qb.andWhere('swap.createdAt >= :fromDate', { fromDate: new Date(filters.from) });
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setUTCHours(23, 59, 59, 999);
      qb.andWhere('swap.createdAt <= :toDate', { toDate });
    }
    if (filters.serial?.trim()) {
      const serial = filters.serial.trim().slice(0, 80);
      qb.andWhere('(removedBattery.serialNumber LIKE :serial OR installedBattery.serialNumber LIKE :serial)', { serial: `%${serial}%` });
    }
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
