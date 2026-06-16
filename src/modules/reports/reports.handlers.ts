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

export const getReportHandler = async (c: AppContext) => {
  const ticketId = c.req.param("ticketId");
  if (!ticketId) {
    return c.json(
      {
        message: "Ticket ID is required",
      },
      HttpStatusCodes.BAD_REQUEST,
    );
  }
  const db = getDb(c.env);

  try {
    const rows = await db
      .select({
        ticketId: reports.ticketId,
        violationDate: reports.violationDate,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        adminNotes: reports.adminNotes,
        merchantName: merchants.name,
        merchantCity: merchants.city,
        merchantAddress: merchants.address,
        evidenceUrl: reportEvidences.fileUrl,
      })
      .from(reports)
      .leftJoin(merchants, eq(reports.merchantId, merchants.id))
      .leftJoin(reportEvidences, eq(reports.id, reportEvidences.reportId))
      .where(eq(reports.ticketId, ticketId))
      .limit(1);

    if (rows.length === 0) {
      return c.json(
        {
          message: "Report not found",
        },
        HttpStatusCodes.NOT_FOUND,
      );
    }

    const row = rows[0];

    return c.json(
      {
        success: true as const,
        data: {
          ticketId: row.ticketId,
          violationDate: row.violationDate.toISOString(),
          description: row.description,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          adminNotes: row.adminNotes,
          merchantName: row.merchantName || "Unknown",
          merchantCity: row.merchantCity || null,
          merchantAddress: row.merchantAddress || null,
          evidenceUrl: row.evidenceUrl || null,
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error retrieving report:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve report";
    return c.json(
      {
        message,
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getMyReportsHandler = async (c: AppContext) => {
  const db = getDb(c.env);
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

  if (!reporterId) {
    return c.json(
      {
        message: "Unauthorized. Please log in to view your reports.",
      },
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  try {
    const rows = await db
      .select({
        ticketId: reports.ticketId,
        merchantName: merchants.name,
        violationCategory: reports.description,
        createdAt: reports.createdAt,
        status: reports.status,
      })
      .from(reports)
      .leftJoin(merchants, eq(reports.merchantId, merchants.id))
      .where(eq(reports.reporterId, reporterId));

    return c.json(
      {
        success: true as const,
        data: rows.map((r) => ({
          ticketId: r.ticketId,
          merchantName: r.merchantName || "Unknown",
          violationCategory: r.violationCategory || "Surcharge QRIS",
          createdAt: r.createdAt.toISOString(),
          status: r.status,
        })),
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error retrieving my reports:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve reports";
    return c.json({ message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
