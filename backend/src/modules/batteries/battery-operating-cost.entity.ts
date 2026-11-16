import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Battery } from './battery.entity';
import { BatteryMaintenanceTask } from './battery-health.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export enum BatteryCostType { CHARGING='CHARGING', MAINTENANCE='MAINTENANCE', REPLACEMENT='REPLACEMENT', OTHER='OTHER' }

@Entity('battery_operating_costs')
@Index('IDX_battery_cost_station_occurred',['stationId','occurredAt'])
@Index('IDX_battery_cost_battery_occurred',['batteryId','occurredAt'])
@Index('IDX_battery_cost_type_occurred',['costType','occurredAt'])
export class BatteryOperatingCost {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) batteryId:number;
  @ManyToOne(()=>Battery,{onDelete:'NO ACTION'}) @JoinColumn({name:'batteryId',foreignKeyConstraintName:'FK_battery_cost_battery'}) battery:Battery;
  @Column({type:'int'}) stationId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'stationId',foreignKeyConstraintName:'FK_battery_cost_station'}) station:Station;
  @Column({type:'varchar',length:20}) costType:BatteryCostType;
  @Column({type:'decimal',precision:14,scale:2}) amount:string;
  @Column({type:'decimal',precision:10,scale:3,nullable:true}) energyKwh:string|null;
  @Column({type:'decimal',precision:12,scale:2,nullable:true}) unitPrice:string|null;
  @Column({type:'int',nullable:true}) maintenanceTaskId:number|null;
  @ManyToOne(()=>BatteryMaintenanceTask,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'maintenanceTaskId',foreignKeyConstraintName:'FK_battery_cost_maintenance'}) maintenanceTask:BatteryMaintenanceTask|null;
  @Column({type:'int'}) recordedById:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'recordedById',foreignKeyConstraintName:'FK_battery_cost_user'}) recordedBy:User;
  @Column({type:'datetime2'}) occurredAt:Date;
  @Column({type:'nvarchar',length:500,nullable:true}) note:string|null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
}
