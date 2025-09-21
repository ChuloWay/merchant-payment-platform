import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { PaymentStatus } from '../../payments/entities/payment.entity';

export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Payment reference',
    example: 'PAY-2024-001-ABC123',
  })
  @IsNotEmpty()
  @IsString()
  reference: string;

  @ApiProperty({
    description: 'Updated payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  @IsNotEmpty()
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({
    description: 'Gateway reference from payment processor',
    example: 'paystack_ref_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiProperty({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds',
    required: false,
  })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @ApiProperty({
    description: 'Additional webhook metadata',
    example: { processor: 'paystack', transactionId: 'txn_123456' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
