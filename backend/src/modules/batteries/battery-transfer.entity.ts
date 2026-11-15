import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export enum BatteryTransferStatus { PENDING='PENDING', IN_TRANSIT='IN_TRANSIT', COMPLETED='COMPLETED', CANCELLED='CANCELLED' }

@Entity('battery_transfers')
@Index('IDX_battery_transfers_source_status',['sourceStationId','status'])
@Index('IDX_battery_transfers_destination_status',['destinationStationId','status'])
export class BatteryTransfer {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) sourceStationId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'sourceStationId',foreignKeyConstraintName:'FK_battery_transfers_source'}) sourceStation:Station;
  @Column({type:'int'}) destinationStationId:number;
  @ManyToOne(()=>Station,{onDelete:'NO ACTION'}) @JoinColumn({name:'destinationStationId',foreignKeyConstraintName:'FK_battery_transfers_destination'}) destinationStation:Station;
  @Column({type:'int'}) createdById:number;
  @ManyToOne(()=>User,{onDelete:'NO ACTION'}) @JoinColumn({name:'createdById',foreignKeyConstraintName:'FK_battery_transfers_creator'}) createdBy:User;
  @Column({type:'int',nullable:true}) dispatchedById:number|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'dispatchedById',foreignKeyConstraintName:'FK_battery_transfers_dispatcher'}) dispatchedBy:User|null;
  @Column({type:'int',nullable:true}) receivedById:number|null;
  @ManyToOne(()=>User,{nullable:true,onDelete:'NO ACTION'}) @JoinColumn({name:'receivedById',foreignKeyConstraintName:'FK_battery_transfers_receiver'}) receivedBy:User|null;
  @Column({type:'varchar',length:20,default:BatteryTransferStatus.PENDING}) status:BatteryTransferStatus;
  @Column({type:'nvarchar',length:500,nullable:true}) note:string|null;
  @Column({type:'datetime2',nullable:true}) dispatchedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) receivedAt:Date|null;
  @Column({type:'datetime2',nullable:true}) cancelledAt:Date|null;
  @CreateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) createdAt:Date;
  @UpdateDateColumn({type:'datetime2',default:()=> 'SYSUTCDATETIME()'}) updatedAt:Date;
  @OneToMany(()=>BatteryTransferItem,item=>item.transfer) items:BatteryTransferItem[];
}

@Entity('battery_transfer_items')
@Index('UQ_battery_transfer_items_battery_active',['batteryId','transferId'],{unique:true})
export class BatteryTransferItem {
  @PrimaryGeneratedColumn() id:number;
  @Column({type:'int'}) transferId:number;
  @ManyToOne(()=>BatteryTransfer,transfer=>transfer.items,{onDelete:'NO ACTION'}) @JoinColumn({name:'transferId',foreignKeyConstraintName:'FK_battery_transfer_items_transfer'}) transfer:BatteryTransfer;
  @Column({type:'int'}) batteryId:number;
  @Column({type:'int'}) serialSnapshotId:number;
  @ManyToOne('Battery',{onDelete:'NO ACTION'}) @JoinColumn({name:'batteryId',foreignKeyConstraintName:'FK_battery_transfer_items_battery'}) battery:unknown;
}
