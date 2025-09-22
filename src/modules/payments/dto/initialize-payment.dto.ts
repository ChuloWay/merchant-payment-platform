import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  IsObject,
  Min,
  Max,
  IsString,
  Length,
  IsIn,
} from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Payment amount in NGN (Nigerian Naira)',
    example: 50000.0,
    minimum: 1,
    maximum: 10000000,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000000)
  amount: number;

  @ApiProperty({
    description: 'Payment currency code (must be NGN)',
    example: 'NGN',
    minLength: 3,
    maxLength: 3,
    default: 'NGN',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(['NGN'], { message: 'Only NGN currency is supported' })
  currency?: string;

  @ApiProperty({
    description: 'Payment method ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({
    description: 'Customer information and order details',
    example: {
      customerId: 'CUST-123456',
      customerName: 'Adebayo Ogunlesi',
      customerEmail: 'adebayo@example.com',
      customerPhone: '+2348012345678',
      orderId: 'ORDER-789012',
      description: 'Payment for Lagos Tech Solutions services',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
