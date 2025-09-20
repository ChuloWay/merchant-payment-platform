import { ApiProperty } from '@nestjs/swagger';

export class MerchantResponseDto {
  @ApiProperty({
    description: 'Merchant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Merchant business name',
    example: 'Lagos Tech Solutions Ltd',
  })
  name: string;

  @ApiProperty({
    description: 'Merchant email address',
    example: 'contact@lagostech.com.ng',
  })
  email: string;

  @ApiProperty({
    description: 'Merchant API key',
    example: 'pk_1a2b3c4d_5e6f7g8h9i0j1k2l3m4n5o6p',
  })
  apiKey: string;

  @ApiProperty({
    description: 'Webhook URL for payment notifications',
    example: 'https://api.lagostech.com.ng/webhooks/payments',
    required: false,
  })
  webhookUrl?: string;

  @ApiProperty({
    description: 'Merchant active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Merchant creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Merchant last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
