import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Next,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('payment-methods')
@Controller('payment-methods')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('api-key')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new payment method',
    description:
      'Creates a new payment method for the authenticated merchant. Supports cards, bank transfers, USSD, and bank accounts for Nigerian market.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
  ) {
    try {
      const merchant = (req as any).merchant;
      const paymentMethod = await this.paymentMethodsService.create(
        merchant.id,
        createPaymentMethodDto,
      );
      return res.status(HttpStatus.CREATED).json({
        statusCode: HttpStatus.CREATED,
        data: paymentMethod,
        message: 'Payment method created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get merchant payment methods',
    description:
      'Retrieves all active payment methods for the authenticated merchant',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
    type: [PaymentMethodResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
  ) {
    try {
      const merchant = (req as any).merchant;
      const paymentMethods = await this.paymentMethodsService.findByMerchant(merchant.id);
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: paymentMethods,
        message: 'Payment methods retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment method by ID',
    description: 'Retrieves a specific payment method by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async findOne(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('id') id: string,
  ) {
    try {
      const paymentMethod = await this.paymentMethodsService.findById(id);
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: paymentMethod,
        message: 'Payment method retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate payment method',
    description: 'Deactivates a payment method for the authenticated merchant',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Payment method deactivated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async remove(
    @Res() res: Response,
    @Req() req: Request,
    @Next() next: NextFunction,
    @Param('id') id: string,
  ) {
    try {
      const merchant = (req as any).merchant;
      await this.paymentMethodsService.deactivate(id, merchant.id);
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: null,
        message: 'Payment method deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
