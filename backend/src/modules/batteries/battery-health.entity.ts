import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Battery } from './battery.entity';

@Entity('battery_health_checks')
@Index('IDX_battery_health_checks_battery_created',['batteryId','createdAt'])
export class BatteryHealthCheck {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) batteryId:number;
  @ManyToOne(()=>Battery,{onDelete:'NO ACTION'}) @JoinColumn({name:'batteryId',foreignKeyConstraintName:'FK_battery_health_checks_battery'}) battery:Battery;
  @Column({type:'int'}) stationId:number;
  @Column({type:'int'}) healthPercent:number;
  @Column({type:'int'}) cycleCount:number;
  @Column({type:'nvarchar',length:500,nullable:true}) note:string|null;
  @Column({type:'int'}) recordedById:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'recordedById',foreignKeyConstraintName:'FK_battery_health_checks_user'}) recordedBy:User;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
}

export enum BatteryMaintenanceStatus { OPEN='OPEN', IN_PROGRESS='IN_PROGRESS', COMPLETED='COMPLETED', CANCELLED='CANCELLED' }

@Entity('battery_maintenance_tasks')
@Index('IDX_battery_maintenance_station_status_due',['stationId','status','dueAt'])
@Index('IDX_battery_maintenance_battery_created',['batteryId','createdAt'])
export class BatteryMaintenanceTask {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) batteryId:number;
  @ManyToOne(()=>Battery,{onDelete:'NO ACTION'}) @JoinColumn({name:'batteryId',foreignKeyConstraintName:'FK_battery_maintenance_battery'}) battery:Battery;
  @Column({type:'int'}) stationId:number;
  @Column({type:'int'}) createdById:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'createdById',foreignKeyConstraintName:'FK_battery_maintenance_creator'}) createdBy:User;
  @Column({type:'int',nullable:true}) completedById:number|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'completedById',foreignKeyConstraintName:'FK_battery_maintenance_completer'}) completedBy:User|null;
  @Column({type:'varchar',length:40}) taskType:string;
  @Column({type:'varchar',length:12,default:'NORMAL'}) priority:string;
  @Column({type:'varchar',length:20,default:BatteryMaintenanceStatus.OPEN}) status:BatteryMaintenanceStatus;
  @Column({type:'datetime2',nullable:true}) dueAt:Date|null;
  @Column({type:'nvarchar',length:1000}) description:string;
  @Column({type:'nvarchar',length:2000,nullable:true}) result:string|null;
  @Column({type:'decimal',precision:12,scale:2,nullable:true}) cost:string|null;
  @Column({type:'datetime2',nullable:true}) startedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) completedAt:Date|null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
}
