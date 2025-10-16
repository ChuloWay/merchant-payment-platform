import { proxyActivities, setHandler, defineQuery, defineSignal, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/payment.activities';

const { 
  validatePayment, 
  processPaymentWithGateway, 
  updatePaymentStatus, 
  sendWebhookNotification,
  compensatePayment,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export const paymentStatusQuery = defineQuery<string>('paymentStatus');
export const cancelPaymentSignal = defineSignal('cancelPayment');

export interface PaymentWorkflowInput {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  merchantId: string;
  paymentMethodId: string;
  metadata?: any;
}

export interface PaymentWorkflowResult {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  status: 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  webhookDelivered: boolean;
}

export async function PaymentProcessingWorkflow(input: PaymentWorkflowInput): Promise<PaymentWorkflowResult> {
  let currentStatus = 'initiated';
  let shouldCancel = false;

  setHandler(paymentStatusQuery, () => currentStatus);
  setHandler(cancelPaymentSignal, () => {
    shouldCancel = true;
  });

  try {
    currentStatus = 'validating';
    const validationResult = await validatePayment(input);
    
    if (!validationResult.isValid) {
      currentStatus = 'validation_failed';
      await compensatePayment(input.paymentId, validationResult.reason || 'Validation failed');
      
      return {
        success: false,
        paymentId: input.paymentId,
        status: 'failed',
        errorMessage: validationResult.reason,
        webhookDelivered: false,
      };
    }

    if (shouldCancel) {
      currentStatus = 'cancelled';
      await updatePaymentStatus(input.paymentId, 'cancelled');
      return {
        success: false,
        paymentId: input.paymentId,
        status: 'cancelled',
        errorMessage: 'Payment was cancelled',
        webhookDelivered: false,
      };
    }

    currentStatus = 'processing';
    await updatePaymentStatus(input.paymentId, 'processing');

    await sleep('2s');

    const processingResult = await processPaymentWithGateway(input);
    
    if (!processingResult.success) {
      currentStatus = 'processing_failed';
      await compensatePayment(
        input.paymentId, 
        processingResult.errorMessage || 'Gateway processing failed'
      );
      
      return {
        success: false,
        paymentId: input.paymentId,
        status: 'failed',
        errorMessage: processingResult.errorMessage,
        webhookDelivered: false,
      };
    }

    currentStatus = 'completed';
    await updatePaymentStatus(input.paymentId, 'completed', processingResult.transactionId);

    let webhookDelivered = false;
    try {
      currentStatus = 'sending_webhook';
      const webhookResult = await sendWebhookNotification(input, 'completed');
      webhookDelivered = webhookResult.success;
      
      if (!webhookResult.success) {
        currentStatus = 'webhook_failed';
      } else {
        currentStatus = 'webhook_delivered';
      }
    } catch (webhookError) {
      currentStatus = 'webhook_error';
    }

    return {
      success: true,
      paymentId: input.paymentId,
      transactionId: processingResult.transactionId,
      status: 'completed',
      webhookDelivered,
    };

  } catch (error) {
    currentStatus = 'error';
    
    try {
      await compensatePayment(input.paymentId, error.message || 'Workflow error');
    } catch (compensationError) {
      currentStatus = 'compensation_failed';
    }

    return {
      success: false,
      paymentId: input.paymentId,
      status: 'failed',
      errorMessage: error.message || 'Unknown workflow error',
      webhookDelivered: false,
    };
  }
}

