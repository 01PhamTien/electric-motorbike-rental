import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BatterySwap } from './battery-swap.entity';

export enum BatteryReservationStatus {
  RESERVED='RESERVED',
  REDEEMED='REDEEMED',
  CANCELLED='CANCELLED',
  EXPIRED='EXPIRED',
}

@Entity('battery_reservations')
@Check('CK_battery_reservations_status', "[status] IN ('RESERVED','REDEEMED','CANCELLED','EXPIRED')")
@Index('IDX_battery_reservations_station_status_expiry',['stationId','status','expiresAt'])
@Index('IDX_battery_reservations_customer_status_expiry',['customerId','status','expiresAt'])
export class BatteryReservation {
  @PrimaryGeneratedColumn() id:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'customerId',foreignKeyConstraintName:'FK_battery_reservations_customer'}) customer:User;
  @Column({type:'int'}) customerId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'stationId',foreignKeyConstraintName:'FK_battery_reservations_station'}) station:Station;
  @Column({type:'int'}) stationId:number;
  @ManyToOne(()=>Booking,{onDelete:'NO ACTION'}) @JoinColumn({name:'bookingId',foreignKeyConstraintName:'FK_battery_reservations_booking'}) booking:Booking;
  @Column({type:'int'}) bookingId:number;
  @ManyToOne(()=>Vehicle,{onDelete:'NO ACTION'}) @JoinColumn({name:'vehicleId',foreignKeyConstraintName:'FK_battery_reservations_vehicle'}) vehicle:Vehicle;
  @Column({type:'int'}) vehicleId:number;
  @Column({type:'varchar',length:20,default:BatteryReservationStatus.RESERVED}) status:BatteryReservationStatus;
  @Column({type:'datetime2'}) expiresAt:Date;
  @Column({type:'datetime2',nullable:true}) redeemedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) cancelledAt:Date|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'redeemedById',foreignKeyConstraintName:'FK_battery_reservations_redeemed_by'}) redeemedBy:User|null;
  @Column({type:'int',nullable:true}) redeemedById:number|null;
  @ManyToOne(()=>BatterySwap,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'batterySwapId',foreignKeyConstraintName:'FK_battery_reservations_swap'}) batterySwap:BatterySwap|null;
  @Column({type:'int',nullable:true}) batterySwapId:number|null;
  @CreateDateColumn({type:'datetime2'}) createdAt:Date;
  @UpdateDateColumn({type:'datetime2'}) updatedAt:Date;
}
