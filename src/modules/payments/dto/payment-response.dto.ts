import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment.entity';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment reference',
    example: 'PAY-2024-001-ABC123',
  })
  reference: string;

  @ApiProperty({
    description: 'Payment amount in NGN',
    example: 50000.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment currency',
    example: 'NGN',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'Merchant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  merchantId: string;

  @ApiProperty({
    description: 'Payment method ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  paymentMethodId: string;

  @ApiProperty({
    description: 'Gateway reference from payment processor',
    example: 'paystack_ref_123456',
    required: false,
  })
  gatewayReference?: string;

  @ApiProperty({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds',
    required: false,
  })
  failureReason?: string;

  @ApiProperty({
    description: 'Payment metadata',
    example: {
      customerId: 'CUST-123456',
      customerName: 'Adebayo Ogunlesi',
      orderId: 'ORDER-789012',
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Payment initiation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  initiatedAt: Date;

  @ApiProperty({
    description: 'Payment completion timestamp',
    example: '2024-01-15T10:35:00Z',
    required: false,
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Payment creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Payment last update timestamp',
    example: '2024-01-15T10:35:00Z',
  })
  updatedAt: Date;
}
