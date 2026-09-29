ALTER TABLE "gift_payments" ADD COLUMN "order_id" uuid;--> statement-breakpoint
CREATE INDEX "gift_payments_order_idx" ON "gift_payments" USING btree ("order_id");