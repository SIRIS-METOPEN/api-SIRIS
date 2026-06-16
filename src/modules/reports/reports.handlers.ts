import type { AppContext } from "../../factory";
import { getDb } from "../../db";
import { createAuth } from "../../auth";
import {
  merchants,
  reports,
  reportEvidences,
  users,
  reportHistories,
} from "../../db/schema";
import { uploadToCloudinary } from "../../services/cloudinary.service";
import { eq, ilike, and, or, gte, lt, desc, sql } from "drizzle-orm";
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

export const getDashboardMetricsHandler = async (c: AppContext) => {
  const db = getDb(c.env);
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const getTrend = (current: number, last: number) => {
    if (last === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - last) / last) * 100);
  };

  try {
    // Total Reports
    const [totalAllTime] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports);
    const [totalCurrent] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(gte(reports.createdAt, startOfCurrentMonth));
    const [totalLast] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          gte(reports.createdAt, startOfLastMonth),
          lt(reports.createdAt, startOfCurrentMonth),
        ),
      );

    // Pending Verification ("submitted")
    const [pendingAllTime] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(eq(reports.status, "submitted"));
    const [pendingCurrent] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "submitted"),
          gte(reports.createdAt, startOfCurrentMonth),
        ),
      );
    const [pendingLast] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "submitted"),
          gte(reports.createdAt, startOfLastMonth),
          lt(reports.createdAt, startOfCurrentMonth),
        ),
      );

    // Active Investigation ("in_review")
    const [activeAllTime] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(eq(reports.status, "in_review"));
    const [activeCurrent] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "in_review"),
          gte(reports.createdAt, startOfCurrentMonth),
        ),
      );
    const [activeLast] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "in_review"),
          gte(reports.createdAt, startOfLastMonth),
          lt(reports.createdAt, startOfCurrentMonth),
        ),
      );

    // Resolved Reports ("resolved")
    const [resolvedAllTime] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(eq(reports.status, "resolved"));
    const [resolvedCurrent] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "resolved"),
          gte(reports.createdAt, startOfCurrentMonth),
        ),
      );
    const [resolvedLast] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .where(
        and(
          eq(reports.status, "resolved"),
          gte(reports.createdAt, startOfLastMonth),
          lt(reports.createdAt, startOfCurrentMonth),
        ),
      );

    return c.json(
      {
        success: true as const,
        data: {
          totalReports: {
            value: totalAllTime?.count || 0,
            trend: getTrend(totalCurrent?.count || 0, totalLast?.count || 0),
          },
          pendingVerification: {
            value: pendingAllTime?.count || 0,
            trend: getTrend(
              pendingCurrent?.count || 0,
              pendingLast?.count || 0,
            ),
          },
          investigationActive: {
            value: activeAllTime?.count || 0,
            trend: getTrend(activeCurrent?.count || 0, activeLast?.count || 0),
          },
          resolvedReports: {
            value: resolvedAllTime?.count || 0,
            trend: getTrend(
              resolvedCurrent?.count || 0,
              resolvedLast?.count || 0,
            ),
          },
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error calculating metrics:", error);
    return c.json(
      { message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const adminGetReportsHandler = async (c: AppContext) => {
  const db = getDb(c.env);
  const { page = "1", limit = "10", status, search } = c.req.query();
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  try {
    const conditions = [];

    if (status) {
      conditions.push(
        eq(
          reports.status,
          status as
            | "draft"
            | "submitted"
            | "in_review"
            | "verified"
            | "rejected"
            | "resolved",
        ),
      );
    }

    if (search) {
      conditions.push(
        or(
          ilike(reports.ticketId, `%${search}%`),
          ilike(reports.description, `%${search}%`),
          ilike(merchants.name, `%${search}%`),
          ilike(merchants.city, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::integer` })
      .from(reports)
      .leftJoin(merchants, eq(reports.merchantId, merchants.id))
      .where(whereClause);

    const total = countResult?.count || 0;

    const rows = await db
      .select({
        id: reports.id,
        ticketId: reports.ticketId,
        violationCategory: reports.description,
        merchantName: merchants.name,
        merchantCity: merchants.city,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .leftJoin(merchants, eq(reports.merchantId, merchants.id))
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limitNum)
      .offset(offset);

    return c.json(
      {
        success: true as const,
        data: rows.map((r) => ({
          id: r.id,
          ticketId: r.ticketId,
          violationCategory: r.violationCategory
            ? r.violationCategory.substring(0, 50)
            : "Surcharge QRIS",
          merchantName: r.merchantName || "Unknown",
          merchantCity: r.merchantCity,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error retrieving admin reports:", error);
    return c.json(
      { message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const adminGetReportDetailHandler = async (c: AppContext) => {
  const db = getDb(c.env);
  const id = c.req.param("id")!;

  try {
    const [reportRow] = await db
      .select({
        id: reports.id,
        ticketId: reports.ticketId,
        violationDate: reports.violationDate,
        description: reports.description,
        status: reports.status,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        adminNotes: reports.adminNotes,
        merchantId: reports.merchantId,
        reporterId: reports.reporterId,
        isAnonymous: reports.isAnonymous,
        reporterName: reports.reporterName,
        reporterPhone: reports.reporterPhone,
      })
      .from(reports)
      .where(eq(reports.id, id));

    if (!reportRow) {
      return c.json({ message: "Report not found" }, HttpStatusCodes.NOT_FOUND);
    }

    let merchantObj = {
      id: "",
      name: "",
      city: null as string | null,
      address: null as string | null,
      latitude: null as number | null,
      longitude: null as number | null,
    };
    if (reportRow.merchantId) {
      const [m] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, reportRow.merchantId));
      if (m) {
        merchantObj = {
          id: m.id,
          name: m.name,
          city: m.city,
          address: m.address,
          latitude: m.latitude,
          longitude: m.longitude,
        };
      }
    }

    let reporterObj = {
      name: reportRow.reporterName,
      phone: reportRow.reporterPhone,
      email: null as string | null,
      isAnonymous: reportRow.isAnonymous,
    };
    if (reportRow.reporterId && !reportRow.isAnonymous) {
      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.id, reportRow.reporterId));
      if (u) {
        reporterObj.name = reporterObj.name || u.name;
        reporterObj.phone = reporterObj.phone || u.phone;
        reporterObj.email = u.email;
      }
    }

    const evidencesRows = await db
      .select()
      .from(reportEvidences)
      .where(eq(reportEvidences.reportId, reportRow.id));

    const historiesRows = await db
      .select({
        id: reportHistories.id,
        oldStatus: reportHistories.oldStatus,
        newStatus: reportHistories.newStatus,
        notes: reportHistories.notes,
        createdAt: reportHistories.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(reportHistories)
      .leftJoin(users, eq(reportHistories.actorId, users.id))
      .where(eq(reportHistories.reportId, reportRow.id))
      .orderBy(desc(reportHistories.createdAt));

    return c.json(
      {
        success: true as const,
        data: {
          id: reportRow.id,
          ticketId: reportRow.ticketId,
          violationDate: reportRow.violationDate.toISOString(),
          description: reportRow.description,
          status: reportRow.status,
          createdAt: reportRow.createdAt.toISOString(),
          updatedAt: reportRow.updatedAt.toISOString(),
          adminNotes: reportRow.adminNotes,
          merchant: merchantObj,
          reporter: reporterObj,
          evidences: evidencesRows.map((e) => ({
            id: e.id,
            fileUrl: e.fileUrl,
            fileType: e.fileType,
            fileName: e.fileName,
          })),
          history: historiesRows.map((h) => ({
            id: h.id,
            oldStatus: h.oldStatus,
            newStatus: h.newStatus,
            notes: h.notes,
            createdAt: h.createdAt.toISOString(),
            actorName: h.actorName || h.actorEmail || "System",
          })),
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error retrieving report detail:", error);
    return c.json(
      { message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const updateReportStatusHandler = async (c: AppContext) => {
  const db = getDb(c.env);
  const id = c.req.param("id")!;
  const input = (await c.req.json()) as { status: string; notes?: string };
  const user = c.get("user");

  if (!user) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const actorId = user.id;

  try {
    const [currentReport] = await db
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, id));

    if (!currentReport) {
      return c.json({ message: "Report not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const oldStatus = currentReport.status;
    const newStatus = input.status;

    const [updatedReport] = await db
      .update(reports)
      .set({
        status: newStatus as
          | "draft"
          | "submitted"
          | "in_review"
          | "verified"
          | "rejected"
          | "resolved",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    await db.insert(reportHistories).values({
      reportId: id,
      actorId: actorId,
      oldStatus,
      newStatus,
      notes: input.notes || null,
    });

    return c.json(
      {
        success: true as const,
        data: {
          id: updatedReport.id,
          status: updatedReport.status,
          updatedAt: updatedReport.updatedAt.toISOString(),
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error updating report status:", error);
    return c.json(
      { message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const updateInternalNotesHandler = async (c: AppContext) => {
  const db = getDb(c.env);
  const id = c.req.param("id")!;
  const input = (await c.req.json()) as { notes: string };

  try {
    const [updatedReport] = await db
      .update(reports)
      .set({
        adminNotes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (!updatedReport) {
      return c.json({ message: "Report not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(
      {
        success: true as const,
        data: {
          id: updatedReport.id,
          adminNotes: updatedReport.adminNotes,
          updatedAt: updatedReport.updatedAt.toISOString(),
        },
      },
      HttpStatusCodes.OK,
    );
  } catch (error: unknown) {
    console.error("Error updating internal notes:", error);
    return c.json(
      { message: "Internal server error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
