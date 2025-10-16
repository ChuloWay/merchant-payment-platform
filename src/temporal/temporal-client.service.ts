import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import { PaymentProcessingWorkflow, PaymentWorkflowInput, PaymentWorkflowResult } from './workflows/payment-processing.workflow';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TemporalClientService implements OnModuleInit {
  private readonly logger = new Logger(TemporalClientService.name);
  private client: Client | null = null;
  private isEnabled: boolean;
  private taskQueue: string;
  private namespace: string;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('ENABLE_TEMPORAL_WORKFLOWS', false);
    this.taskQueue = this.configService.get<string>('TEMPORAL_TASK_QUEUE', 'payment-processing');
    this.namespace = this.configService.get<string>('TEMPORAL_NAMESPACE', 'default');
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('Temporal workflows are disabled via ENABLE_TEMPORAL_WORKFLOWS flag');
      return;
    }

    try {
      const temporalAddress = this.configService.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
      
      const connection = await Connection.connect({
        address: temporalAddress,
      });

      this.client = new Client({
        connection,
        namespace: this.namespace,
      });

      this.logger.log('Temporal client initialized successfully');
      this.logger.log(`Address: ${temporalAddress}`);
      this.logger.log(`Namespace: ${this.namespace}`);
      this.logger.log(`Task Queue: ${this.taskQueue}`);
    } catch (error) {
      this.logger.error('Failed to initialize Temporal client', error.stack);
      this.client = null;
    }
  }

  async startPaymentWorkflow(input: PaymentWorkflowInput): Promise<{ workflowId: string; runId: string } | null> {
    if (!this.isEnabled) {
      this.logger.debug(`Temporal disabled - would have started workflow for payment: ${input.paymentId}`);
      return null;
    }

    if (!this.client) {
      this.logger.warn('Temporal client not available, skipping workflow start');
      return null;
    }

    try {
      const workflowId = `payment-${input.paymentId}-${uuidv4().substring(0, 8)}`;

      const handle = await this.client.workflow.start(PaymentProcessingWorkflow, {
        taskQueue: this.taskQueue,
        workflowId,
        args: [input],
        workflowExecutionTimeout: '10 minutes',
        workflowRunTimeout: '5 minutes',
        workflowTaskTimeout: '1 minute',
      });

      this.logger.log(
        `✓ Temporal workflow started: ${workflowId} | Run ID: ${handle.firstExecutionRunId} | Payment: ${input.paymentId}`
      );

      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      this.logger.error(`Failed to start Temporal workflow for payment: ${input.paymentId}`, error.stack);
      throw error;
    }
  }

  async getWorkflowResult(workflowId: string): Promise<PaymentWorkflowResult | null> {
    if (!this.client) {
      this.logger.warn('Temporal client not available');
      return null;
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId);
      const result = await handle.result();
      return result as PaymentWorkflowResult;
    } catch (error) {
      this.logger.error(`Failed to get workflow result: ${workflowId}`, error.stack);
      throw error;
    }
  }

  async queryWorkflowStatus(workflowId: string): Promise<string | null> {
    if (!this.client) {
      this.logger.warn('Temporal client not available');
      return null;
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId);
      const status = await handle.query('paymentStatus');
      return status as string;
    } catch (error) {
      this.logger.error(`Failed to query workflow status: ${workflowId}`, error.stack);
      throw error;
    }
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    if (!this.client) {
      this.logger.warn('Temporal client not available');
      return;
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId);
      await handle.signal('cancelPayment');
      this.logger.log(`Workflow cancellation signal sent: ${workflowId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel workflow: ${workflowId}`, error.stack);
      throw error;
    }
  }

  isServiceEnabled(): boolean {
    return this.isEnabled && this.client !== null;
  }
}

