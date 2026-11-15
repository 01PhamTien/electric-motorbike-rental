import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';
import { Battery } from './battery.entity';

export enum BatteryStocktakeStatus { OPEN='OPEN', COMPLETED='COMPLETED', APPROVED='APPROVED' }
export enum BatteryStocktakeCountStatus { PENDING='PENDING', PRESENT='PRESENT', MISSING='MISSING', EXTRA='EXTRA' }

@Entity('battery_stocktakes')
@Index('IDX_battery_stocktakes_station_status',['stationId','status'])
export class BatteryStocktake {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) stationId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'stationId',foreignKeyConstraintName:'FK_battery_stocktakes_station'}) station:Station;
  @Column({type:'int'}) createdById:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'createdById',foreignKeyConstraintName:'FK_battery_stocktakes_creator'}) createdBy:User;
  @Column({type:'int',nullable:true}) completedById:number|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'completedById',foreignKeyConstraintName:'FK_battery_stocktakes_completer'}) completedBy:User|null;
  @Column({type:'int',nullable:true}) approvedById:number|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'approvedById',foreignKeyConstraintName:'FK_battery_stocktakes_approver'}) approvedBy:User|null;
  @Column({type:'varchar',length:20,default:BatteryStocktakeStatus.OPEN}) status:BatteryStocktakeStatus;
  @Column({type:'nvarchar',length:500,nullable:true}) note:string|null;
  @Column({type:'datetime2',nullable:true}) completedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) approvedAt:Date|null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
  @UpdateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) updatedAt:Date;
  @OneToMany(()=>BatteryStocktakeItem,item=>item.stocktake) items:BatteryStocktakeItem[];
}

@Entity('battery_stocktake_items')
@Index('IDX_battery_stocktake_items_stocktake',['stocktakeId'])
@Index('IDX_battery_stocktake_items_battery',['batteryId'])
export class BatteryStocktakeItem {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) stocktakeId:number;
  @ManyToOne(()=>BatteryStocktake,stocktake=>stocktake.items,{onDelete:'NO ACTION'}) @JoinColumn({name:'stocktakeId',foreignKeyConstraintName:'FK_battery_stocktake_items_stocktake'}) stocktake:BatteryStocktake;
  @Column({type:'int',nullable:true}) batteryId:number|null;
  @ManyToOne(()=>Battery,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'batteryId',foreignKeyConstraintName:'FK_battery_stocktake_items_battery'}) battery:Battery|null;
  @Column({type:'varchar',length:80}) serialSnapshot:string;
  @Column({type:'varchar',length:20}) systemStatus:string;
  @Column({type:'int',nullable:true}) systemVehicleId:number|null;
  @Column({type:'bit',default:false}) exempt:boolean;
  @Column({type:'varchar',length:20,default:BatteryStocktakeCountStatus.PENDING}) countStatus:BatteryStocktakeCountStatus;
  @Column({type:'varchar',length:20,nullable:true}) observedStatus:string|null;
  @Column({type:'nvarchar',length:500,nullable:true}) note:string|null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
}
