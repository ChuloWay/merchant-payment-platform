import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1704067200000 implements MigrationInterface {
  name = 'CreateInitialTables1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "apiKey" character varying(255) NOT NULL,
        "webhookUrl" character varying(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_merchants_email" UNIQUE ("email"),
        CONSTRAINT "UQ_merchants_apiKey" UNIQUE ("apiKey"),
        CONSTRAINT "PK_merchants" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL,
        "provider" character varying(100),
        "lastFour" character varying(4),
        "accountNumber" character varying(255),
        "bankCode" character varying(255),
        "bankName" character varying(255),
        "merchantId" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying(255) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'NGN',
        "status" character varying NOT NULL DEFAULT 'pending',
        "merchantId" uuid NOT NULL,
        "paymentMethodId" uuid NOT NULL,
        "gatewayReference" character varying(255),
        "failureReason" character varying(500),
        "metadata" jsonb,
        "initiatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_methods" 
      ADD CONSTRAINT "FK_payment_methods_merchantId" 
      FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_merchantId" 
      FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_paymentMethodId" 
      FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_merchants_email" ON "merchants" ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_merchants_apiKey" ON "merchants" ("apiKey")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_methods_merchantId" ON "payment_methods" ("merchantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payment_methods_type" ON "payment_methods" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payments_reference" ON "payments" ("reference")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payments_status" ON "payments" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payments_merchantId" ON "payments" ("merchantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payments_paymentMethodId" ON "payments" ("paymentMethodId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_payments_initiatedAt" ON "payments" ("initiatedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_payments_initiatedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_paymentMethodId"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_merchantId"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_reference"`);
    await queryRunner.query(`DROP INDEX "IDX_payment_methods_type"`);
    await queryRunner.query(`DROP INDEX "IDX_payment_methods_merchantId"`);
    await queryRunner.query(`DROP INDEX "IDX_merchants_apiKey"`);
    await queryRunner.query(`DROP INDEX "IDX_merchants_email"`);

    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_paymentMethodId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_merchantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_payment_methods_merchantId"`,
    );

    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(`DROP TABLE "merchants"`);
  }
}
