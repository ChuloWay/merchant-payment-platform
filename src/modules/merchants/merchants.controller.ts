import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Res,
  Next,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';

@ApiTags('merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new merchant',
    description:
      'Creates a new merchant account with auto-generated API key for Nigerian businesses',
  })
  @ApiResponse({
    status: 201,
    description: 'Merchant created successfully',
    type: MerchantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 409,
    description: 'Merchant with email already exists',
  })
  async create(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() createMerchantDto: CreateMerchantDto,
  ) {
    try {
      const merchant = await this.merchantsService.create(createMerchantDto);
      return res.status(HttpStatus.CREATED).json({
        statusCode: HttpStatus.CREATED,
        data: merchant,
        message: 'Merchant created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all active merchants',
    description: 'Retrieves a list of all active merchants in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'Merchants retrieved successfully',
    type: [MerchantResponseDto],
  })
  async findAll(
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    try {
      const merchants = await this.merchantsService.findAll();
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: merchants,
        message: 'Merchants retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get merchant by ID',
    description: 'Retrieves a specific merchant by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Merchant UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Merchant retrieved successfully',
    type: MerchantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async findOne(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Param('id') id: string,
  ) {
    try {
      const merchant = await this.merchantsService.findById(id);
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: merchant,
        message: 'Merchant retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
