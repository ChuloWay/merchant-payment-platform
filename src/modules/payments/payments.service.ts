import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { SqsService } from '../events/sqs.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly dataSource: DataSource,
    private readonly sqsService: SqsService,
  ) {}

  async initializePayment(
    merchantId: string,
    initializePaymentDto: InitializePaymentDto,
  ): Promise<PaymentResponseDto> {
    const {
      amount,
      currency = 'NGN',
      paymentMethodId,
      metadata,
    } = initializePaymentDto;

    this.logger.log(`Initializing payment for merchant: ${merchantId}, paymentMethod: ${paymentMethodId}`);

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId, isActive: true },
    });

    if (!paymentMethod) {
      this.logger.error(`Payment method not found: ${paymentMethodId} for merchant: ${merchantId}`);
      throw new NotFoundException('Payment method not found or inactive');
    }

    const reference = this.generatePaymentReference();

    return this.dataSource.transaction(async (manager) => {
      const payment = manager.create(Payment, {
        reference,
        amount,
        currency,
        status: PaymentStatus.PENDING,
        merchantId,
        paymentMethodId,
        metadata,
        initiatedAt: new Date(),
      });

      const savedPayment = await manager.save(payment);

      // Temporarily disable SQS to test payment creation
      try {
        await this.sqsService.publishEvent('payment-initiated', {
          paymentId: savedPayment.id,
          reference: savedPayment.reference,
          amount: savedPayment.amount,
          currency: savedPayment.currency,
          merchantId: savedPayment.merchantId,
          paymentMethodId: savedPayment.paymentMethodId,
          metadata: savedPayment.metadata,
          initiatedAt: savedPayment.initiatedAt,
        });
      } catch (error) {
        this.logger.warn('SQS event publishing failed, continuing with payment creation', error.message);
      }

      this.logger.log(
        `Payment initialized: ${savedPayment.reference} - Amount: ₦${amount.toLocaleString()}`,
      );

      return this.mapToResponseDto(savedPayment);
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    gatewayReference?: string,
    failureReason?: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment status cannot be updated');
    }

    return this.dataSource.transaction(async (manager) => {
      const updateData: Partial<Payment> = {
        status,
        gatewayReference,
        failureReason,
      };

      if (
        status === PaymentStatus.COMPLETED ||
        status === PaymentStatus.FAILED
      ) {
        updateData.completedAt = new Date();
      }

      await manager.update(Payment, paymentId, updateData);

      const updatedPayment = await manager.findOne(Payment, {
        where: { id: paymentId },
      });

      if (!updatedPayment) {
        throw new NotFoundException('Payment not found after update');
      }

      await this.sqsService.publishEvent('payment-completed', {
        paymentId: updatedPayment.id,
        reference: updatedPayment.reference,
        status: updatedPayment.status,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        merchantId: updatedPayment.merchantId,
        gatewayReference: updatedPayment.gatewayReference,
        failureReason: updatedPayment.failureReason,
        completedAt: updatedPayment.completedAt,
      });

      this.logger.log(
        `Payment status updated: ${updatedPayment.reference} - Status: ${status}`,
      );

      return this.mapToResponseDto(updatedPayment);
    });
  }

  async findById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['merchant', 'paymentMethod'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponseDto(payment);
  }

  async findByReference(reference: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { reference },
      relations: ['merchant', 'paymentMethod'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponseDto(payment);
  }

  async findByMerchant(
    merchantId: string,
    limit = 50,
    offset = 0,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return payments.map((payment) => this.mapToResponseDto(payment));
  }

  private generatePaymentReference(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = uuidv4().substring(0, 8);
    return `PAY-${timestamp.toUpperCase()}-${randomPart.toUpperCase()}`;
  }

  private mapToResponseDto(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      merchantId: payment.merchantId,
      paymentMethodId: payment.paymentMethodId,
      gatewayReference: payment.gatewayReference,
      failureReason: payment.failureReason,
      metadata: payment.metadata,
      initiatedAt: payment.initiatedAt,
      completedAt: payment.completedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
