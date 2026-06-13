ALTER TABLE "provider_call_logs" ADD COLUMN "model_route_id" uuid;
ALTER TABLE "provider_call_logs" ADD COLUMN "route_snapshot" jsonb;
