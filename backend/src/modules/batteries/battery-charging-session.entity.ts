import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Battery } from './battery.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export enum BatteryChargingStatus { IN_PROGRESS='IN_PROGRESS', COMPLETED='COMPLETED', CANCELLED='CANCELLED' }

@Entity('battery_charging_sessions')
@Check('CK_battery_charging_sessions_status', "[status] IN ('IN_PROGRESS','COMPLETED','CANCELLED')")
@Index('IDX_battery_charging_sessions_battery_status', ['batteryId','status'])
@Index('IDX_battery_charging_sessions_station_started', ['stationId','startedAt'])
export class BatteryChargingSession {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' }) @JoinColumn({ name:'batteryId', foreignKeyConstraintName:'FK_battery_charging_sessions_battery' }) battery: Battery;
  @Column({type:'int'}) batteryId: number;
  @ManyToOne(() => Station, {onDelete:'NO ACTION'}) @JoinColumn({name:'stationId',foreignKeyConstraintName:'FK_battery_charging_sessions_station'}) station: Station;
  @Column({type:'int'}) stationId: number;
  @ManyToOne(() => User, {onDelete:'NO ACTION'}) @JoinColumn({name:'startedById',foreignKeyConstraintName:'FK_battery_charging_sessions_started_by'}) startedBy: User;
  @Column({type:'int'}) startedById: number;
  @ManyToOne(() => User, {nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'completedById',foreignKeyConstraintName:'FK_battery_charging_sessions_completed_by'}) completedBy: User | null;
  @Column({type:'int',nullable:true}) completedById: number | null;
  @Column({type:'datetime2'}) startedAt: Date;
  @Column({type:'datetime2',nullable:true}) completedAt: Date | null;
  @Column({type:'varchar',length:20,default:BatteryChargingStatus.IN_PROGRESS}) status: BatteryChargingStatus;
  @Column({type:'nvarchar',length:500,nullable:true}) note: string | null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt: Date;
}
