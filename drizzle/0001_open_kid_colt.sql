CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"status" text DEFAULT 'diawasi' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_evidences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reportId" uuid NOT NULL,
	"fileUrl" text NOT NULL,
	"fileType" text,
	"fileName" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" text NOT NULL,
	"reporterId" text,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"reporterName" text,
	"reporterPhone" text,
	"merchantId" uuid,
	"violationDate" timestamp NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_ticketId_unique" UNIQUE("ticketId")
);
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "report_evidences" ADD CONSTRAINT "report_evidences_reportId_reports_id_fk" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_users_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_merchantId_merchants_id_fk" FOREIGN KEY ("merchantId") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;