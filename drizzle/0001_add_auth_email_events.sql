CREATE TYPE "public"."auth_email_event_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."auth_email_event_type" AS ENUM('sign_in_otp', 'magic_link', 'email_verification');--> statement-breakpoint
CREATE TABLE "auth_email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"type" "auth_email_event_type" NOT NULL,
	"status" "auth_email_event_status" NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
