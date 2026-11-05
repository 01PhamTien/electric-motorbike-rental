import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
export class BatteriesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Battery) private readonly batteries: Repository<Battery>,
    @InjectRepository(BatterySwap) private readonly swaps: Repository<BatterySwap>,
    @InjectRepository(BatteryReservation) private readonly reservations: Repository<BatteryReservation>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Optional() private readonly audit?: AuditService,
  ) {}

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
    const qb = this.batteries.createQueryBuilder('battery').leftJoinAndSelect('battery.station','station')
      .leftJoinAndSelect('battery.vehicle','vehicle').orderBy('battery.updatedAt','DESC').take(500);
    if (stationId) { this.assertStation(user, stationId); qb.andWhere('battery.stationId = :stationId',{stationId}); }
    else if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.andWhere('battery.stationId = :stationId',{stationId:user.stationId});
    }
    if (status) qb.andWhere('battery.status = :status',{status});
    return qb.getMany();
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
      const stationRepo=manager.getRepository(Station),bookingRepo=manager.getRepository(Booking),userRepo=manager.getRepository(User);
      const customer=await userRepo.findOne({where:{id:user.sub},lock:{mode:'pessimistic_write'}});
      if(!customer) throw new NotFoundException('Không tìm thấy tài khoản khách hàng');
      const batteryRepo=manager.getRepository(Battery),reservationRepo=manager.getRepository(BatteryReservation);
      const station=await stationRepo.findOne({where:{id:dto.stationId,isActive:true},lock:{mode:'pessimistic_write'}});
      if(!station) throw new NotFoundException('Trạm đổi pin không tồn tại hoặc đã ngừng hoạt động');
      const booking=await bookingRepo.findOne({where:{id:dto.bookingId,customerId:user.sub},lock:{mode:'pessimistic_write'}});
      if(!booking) throw new NotFoundException('Không tìm thấy đơn thuê của bạn');
      if(booking.status!==BookingStatus.RENTING) throw new BadRequestException('Chỉ đơn thuê đang sử dụng xe mới được đặt trước pin');
      if(booking.vehicle?.stationId!==station.id) throw new BadRequestException('Xe thuê hiện không ở trạm này. Vui lòng chọn trạm hiện tại của xe.');
      const now=new Date();
      await reservationRepo.createQueryBuilder().update(BatteryReservation)
        .set({status:BatteryReservationStatus.EXPIRED})
        .where('stationId = :stationId AND status = :status AND expiresAt <= :now',{stationId:station.id,status:BatteryReservationStatus.RESERVED,now}).execute();
      const existing=await reservationRepo.findOne({where:{customerId:user.sub,status:BatteryReservationStatus.RESERVED}});
      if(existing&&existing.expiresAt>now) throw new ConflictException('Bạn đang có một lượt giữ pin. Hãy sử dụng hoặc hủy lượt giữ hiện tại trước.');
      const available=await batteryRepo.count({where:{stationId:station.id,status:BatteryStatus.FULL,vehicleId:IsNull()}});
      const held=await reservationRepo.createQueryBuilder('r').where('r.stationId = :stationId',{stationId:station.id})
        .andWhere('r.status = :status',{status:BatteryReservationStatus.RESERVED})
        .andWhere('r.expiresAt > :now',{now}).getCount();
      if(available-held<=0) throw new ConflictException('Trạm hiện đã hết pin có thể giữ trước. Vui lòng chọn trạm khác.');
      return reservationRepo.save(reservationRepo.create({
        customerId:user.sub,stationId:station.id,bookingId:booking.id,vehicleId:booking.vehicleId,
        status:BatteryReservationStatus.RESERVED,expiresAt:new Date(now.getTime()+10*60_000),
        redeemedAt:null,cancelledAt:null,redeemedById:null,batterySwapId:null,
      }));
    });
    await this.audit?.record(user.sub,'BATTERY_RESERVED','BATTERY_RESERVATION',reservation.id,{stationId:reservation.stationId,bookingId:reservation.bookingId,expiresAt:reservation.expiresAt});
    return reservation;
  }

  async myReservations(user:JwtUser) {
    return this.reservations.find({where:{customerId:user.sub},relations:{station:true,vehicle:true},order:{createdAt:'DESC'},take:50});
  }

  async listReservations(user:JwtUser,stationId?:number) {
    const qb=this.reservations.createQueryBuilder('r').leftJoinAndSelect('r.station','station')
      .leftJoinAndSelect('r.vehicle','vehicle').leftJoinAndSelect('r.booking','booking')
      .orderBy('r.createdAt','DESC').take(200);
    if(stationId){this.assertStation(user,stationId);qb.andWhere('r.stationId = :stationId',{stationId});}
    else if(user.role===Role.STAFF){if(user.stationId==null)return [];qb.andWhere('r.stationId = :stationId',{stationId:user.stationId});}
    return qb.getMany();
  }

  async cancelReservation(user:JwtUser,id:number) {
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryReservation);
      const reservation=await repo.findOne({where:{id},lock:{mode:'pessimistic_write'}});
      if(!reservation) throw new NotFoundException('Không tìm thấy lượt giữ pin');
      if(reservation.customerId!==user.sub) throw new ForbiddenException('Bạn không có quyền hủy lượt giữ pin này');
      if(reservation.status!==BatteryReservationStatus.RESERVED) throw new BadRequestException('Lượt giữ pin này không còn hiệu lực');
      reservation.status=reservation.expiresAt<=new Date()?BatteryReservationStatus.EXPIRED:BatteryReservationStatus.CANCELLED;
      reservation.cancelledAt=new Date();
      return repo.save(reservation);
    });
    await this.audit?.record(user.sub,'BATTERY_RESERVATION_CANCELLED','BATTERY_RESERVATION',id);
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
        throw new BadRequestException('Lượt giữ pin đã hết hạn. Vui lòng tạo lượt giữ mới.');
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
      return {reservation,swap,removedBattery:removed,installedBattery:replacement};
    });
    await this.audit?.record(user.sub,'BATTERY_RESERVATION_REDEEMED','BATTERY_RESERVATION',id,{swapId:result.swap.id,vehicleId:result.swap.vehicleId});
    return result;
  }

  async publicAvailability() {
    const rows=await this.batteries.createQueryBuilder('battery')
      .select('battery.stationId','stationId')
      .addSelect('COUNT(*)','availableBatteryCount')
      .where('battery.status = :status',{status:BatteryStatus.FULL})
      .andWhere('battery.vehicleId IS NULL')
      .groupBy('battery.stationId')
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

  async history(user: JwtUser, stationId?: number) {
    const qb=this.swaps.createQueryBuilder('swap').leftJoinAndSelect('swap.vehicle','vehicle')
      .leftJoinAndSelect('swap.station','station').leftJoinAndSelect('swap.removedBattery','removedBattery')
      .leftJoinAndSelect('swap.installedBattery','installedBattery').orderBy('swap.createdAt','DESC').take(300);
    if(stationId){this.assertStation(user,stationId);qb.andWhere('swap.stationId = :stationId',{stationId});}
    else if(user.role===Role.STAFF){if(!user.stationId)return [];qb.andWhere('swap.stationId = :stationId',{stationId:user.stationId});}
    return qb.getMany();
  }
}
