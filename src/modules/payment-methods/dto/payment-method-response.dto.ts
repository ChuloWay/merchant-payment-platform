import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodType } from '../entities/payment-method.entity';

export class PaymentMethodResponseDto {
  @ApiProperty({
    description: 'Payment method ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    example: PaymentMethodType.CARD,
  })
  type: PaymentMethodType;

  @ApiProperty({
    description: 'Payment provider name',
    example: 'Paystack',
    required: false,
  })
  provider?: string;

  @ApiProperty({
    description: 'Last four digits of card or account',
    example: '1234',
    required: false,
  })
  lastFour?: string;

  @ApiProperty({
    description: 'Bank name',
    example: 'GTBank',
    required: false,
  })
  bankName?: string;

  @ApiProperty({
    description: 'Merchant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  merchantId: string;

  @ApiProperty({
    description: 'Payment method active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Payment method metadata',
    example: { cardType: 'visa', expiryMonth: '12', expiryYear: '2025' },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Payment method creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Payment method last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
