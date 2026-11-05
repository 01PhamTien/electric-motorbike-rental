import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

export enum BatteryReservationStatus {
  RESERVED='RESERVED',
  REDEEMED='REDEEMED',
  CANCELLED='CANCELLED',
  EXPIRED='EXPIRED',
}

@Entity('battery_reservations')
@Index(['stationId','status','expiresAt'])
@Index(['customerId','status','expiresAt'])
export class BatteryReservation {
  @PrimaryGeneratedColumn() id:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'customerId'}) customer:User;
  @Column({type:'int'}) customerId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'stationId'}) station:Station;
  @Column({type:'int'}) stationId:number;
  @ManyToOne(()=>Booking,{onDelete:'NO ACTION'}) @JoinColumn({name:'bookingId'}) booking:Booking;
  @Column({type:'int'}) bookingId:number;
  @ManyToOne(()=>Vehicle,{onDelete:'NO ACTION'}) @JoinColumn({name:'vehicleId'}) vehicle:Vehicle;
  @Column({type:'int'}) vehicleId:number;
  @Column({type:'varchar',length:20,default:BatteryReservationStatus.RESERVED}) status:BatteryReservationStatus;
  @Column({type:'datetime2'}) expiresAt:Date;
  @Column({type:'datetime2',nullable:true}) redeemedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) cancelledAt:Date|null;
  @Column({type:'int',nullable:true}) redeemedById:number|null;
  @Column({type:'int',nullable:true}) batterySwapId:number|null;
  @CreateDateColumn({type:'datetime2'}) createdAt:Date;
  @UpdateDateColumn({type:'datetime2'}) updatedAt:Date;
}
