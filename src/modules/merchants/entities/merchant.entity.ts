import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

@Entity('merchants')
@Index(['apiKey'], { unique: true })
@Index(['email'], { unique: true })
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  apiKey: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookUrl: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Payment, (payment) => payment.merchant)
  payments: Payment[];

  @OneToMany(() => PaymentMethod, (paymentMethod) => paymentMethod.merchant)
  paymentMethods: PaymentMethod[];
}
