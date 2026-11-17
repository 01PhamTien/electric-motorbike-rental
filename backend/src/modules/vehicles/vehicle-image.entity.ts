import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';

@Entity('vehicle_images')
@Index('IDX_vehicle_images_vehicleId', ['vehicleId'])
export class VehicleImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_vehicle_images_vehicle' })
  vehicle: Vehicle;

  @Column({ type: 'int' })
  vehicleId: number;

  @Column({ type: 'nvarchar', length: 2048 })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
