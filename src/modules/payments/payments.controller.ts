import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('payments')
@Controller('payments')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('api-key')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initialize a new payment',
    description:
      'Initializes a new payment transaction in NGN (Nigerian Naira) and publishes a payment-initiated event to SQS',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initialized successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async initializePayment(
    @Body() initializePaymentDto: InitializePaymentDto,
    @Req() request: Request,
  ): Promise<PaymentResponseDto> {
    const merchant = (request as any).merchant;
    return this.paymentsService.initializePayment(
      merchant.id,
      initializePaymentDto,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Retrieves a specific payment by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(@Param('id') id: string): Promise<PaymentResponseDto> {
    return this.paymentsService.findById(id);
  }

  @Get('reference/:reference')
  @ApiOperation({
    summary: 'Get payment by reference',
    description: 'Retrieves a specific payment by its unique reference number',
  })
  @ApiParam({
    name: 'reference',
    description: 'Payment reference',
    example: 'PAY-2024-001-ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentByReference(
    @Param('reference') reference: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.findByReference(reference);
  }

  @Get()
  @ApiOperation({
    summary: 'Get merchant payments',
    description:
      'Retrieves payments for the authenticated merchant with pagination support',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of payments to return (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of payments to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    type: [PaymentResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPayments(
    @Req() request: Request,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PaymentResponseDto[]> {
    const merchant = (request as any).merchant;
    return this.paymentsService.findByMerchant(
      merchant.id,
      limit ? Math.min(parseInt(limit.toString()), 100) : 50,
      offset ? parseInt(offset.toString()) : 0,
    );
  }
}
