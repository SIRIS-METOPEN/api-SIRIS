import type { AppContext } from "../../factory";
import { getDb } from "../../db";
import { createAuth } from "../../auth";
import { merchants, reports, reportEvidences } from "../../db/schema";
import { uploadToCloudinary } from "../../services/cloudinary.service";
import { eq, ilike } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateReportInput } from "./reports.schema";

type DB = ReturnType<typeof getDb>;

/**
 * Generates a unique Ticket ID in the database using the format SRS-YYYY-RANDOM.
 */
async function generateUniqueTicketId(db: DB): Promise<string> {
  const year = new Date().getFullYear();
  let attempts = 0;

  while (attempts < 10) {
    // Generate a 4-digit random number
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    const ticketId = `SRS-${year}-${randomPart}`;

    const existing = await db.query.reports.findFirst({
      where: eq(reports.ticketId, ticketId),
    });

    if (!existing) {
      return ticketId;
    }
    attempts++;
  }
  throw new Error(
    "Failed to generate a unique Ticket ID after multiple attempts",
  );
}

export const createReportHandler = async (c: AppContext) => {
  // Retrieve validated form data with TS workaround for Hono validator type mapping
  const input = c.req.valid("form" as never) as CreateReportInput;
  const db = getDb(c.env);

  // Fetch session from Better Auth to associate report with user if logged in/anonymous
  let reporterId: string | null = null;
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (session?.user) {
      reporterId = session.user.id;
    }
  } catch (err) {
    console.error("Failed to fetch user session:", err);
  }

  let uploadResult: { url: string; publicId: string } | null = null;

  try {
    // Upload file to Cloudinary first
    uploadResult = await uploadToCloudinary(input.evidence, c.env);

    // Run sequential queries (Neon HTTP does not support stateful transactions)

    // Find or create merchant
    let merchant = await db.query.merchants.findFirst({
      where: ilike(merchants.name, input.merchantName),
    });

    if (!merchant) {
      const [newMerchant] = await db
        .insert(merchants)
        .values({
          name: input.merchantName,
          city: input.merchantCity,
          address: input.merchantAddress,
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          status: "diawasi",
        })
        .returning();
      merchant = newMerchant;
    }

    // Generate a unique ticket ID
    const ticketId = await generateUniqueTicketId(db);

    // Insert the report
    const [report] = await db
      .insert(reports)
      .values({
        ticketId,
        reporterId,
        isAnonymous: input.isAnonymous,
        reporterName: input.isAnonymous ? null : input.reporterName || null,
        reporterPhone: input.isAnonymous ? null : input.reporterPhone || null,
        merchantId: merchant.id,
        violationDate: new Date(input.violationDate),
        description: input.description,
        status: "submitted",
      })
      .returning();

    // Insert the report evidence
    const [evidence] = await db
      .insert(reportEvidences)
      .values({
        reportId: report.id,
        fileUrl: uploadResult.url,
        fileType: input.evidence.type,
        fileName: input.evidence.name,
      })
      .returning();

    return c.json(
      {
        success: true as const,
        data: {
          id: report.id,
          ticketId: report.ticketId,
          reporterName: report.reporterName,
          reporterPhone: report.reporterPhone,
          isAnonymous: report.isAnonymous,
          merchantId: report.merchantId,
          violationDate: report.violationDate.toISOString(),
          description: report.description,
          status: report.status,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
          evidenceUrl: evidence.fileUrl,
        },
      },
      HttpStatusCodes.CREATED,
    );
  } catch (error: unknown) {
    console.error("Error creating report:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create report";
    const stack = error instanceof Error ? error.stack : undefined;
    return c.json(
      {
        message,
        data: [stack].filter(Boolean) as string[],
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
};
