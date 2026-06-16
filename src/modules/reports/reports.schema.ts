import { z } from "@hono/zod-openapi";

export const createReportInputSchema = z.object({
  reporterName: z.string().optional().nullable().openapi({
    type: "string",
    description: "Nama pelapor (null jika anonim)",
  }),
  reporterPhone: z.string().optional().nullable().openapi({
    type: "string",
    description: "Nomor telepon pelapor (null jika anonim)",
  }),
  isAnonymous: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === "boolean") return val;
      return val === "true";
    })
    .openapi({
      type: "boolean",
      description: "Apakah laporan bersifat anonim",
    }),
  merchantName: z.string().min(1, "Nama merchant wajib diisi").openapi({
    type: "string",
    description: "Nama merchant pelanggar",
  }),
  merchantCity: z.string().min(1, "Kota merchant wajib diisi").openapi({
    type: "string",
    description: "Kota merchant",
  }),
  merchantAddress: z.string().min(1, "Alamat merchant wajib diisi").openapi({
    type: "string",
    description: "Alamat lengkap merchant",
  }),
  latitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      const parsed = typeof val === "number" ? val : parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    })
    .openapi({
      type: "number",
      description: "Koordinat latitude merchant",
    }),
  longitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      const parsed = typeof val === "number" ? val : parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    })
    .openapi({
      type: "number",
      description: "Koordinat longitude merchant",
    }),
  violationDate: z
    .string()
    .datetime({
      message:
        "Tanggal pelanggaran wajib berupa format ISO Datetime yang valid",
    })
    .openapi({
      type: "string",
      format: "date-time",
      description: "Tanggal dan waktu kejadian (ISO 8601)",
    }),
  description: z
    .string()
    .min(10, "Deskripsi laporan minimal 10 karakter")
    .openapi({
      type: "string",
      description: "Deskripsi kronologi pelanggaran",
    }),
  evidence: z
    .instanceof(File, { message: "Bukti laporan wajib diunggah" })
    .refine(
      (file) => file.size <= 5 * 1024 * 1024,
      "Ukuran file bukti maksimal 5MB",
    )
    .refine(
      (file) =>
        [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(file.type),
      "Format file bukti wajib berupa gambar (JPG, PNG, WEBP) atau PDF",
    )
    .openapi({
      type: "string",
      format: "binary",
      description: "File bukti lampiran (gambar/PDF, max 5MB)",
    }),
});

export const createReportResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.string().uuid(),
      ticketId: z.string(),
      reporterName: z.string().nullable(),
      reporterPhone: z.string().nullable(),
      isAnonymous: z.boolean(),
      merchantId: z.string().uuid().nullable(),
      violationDate: z.string(),
      description: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      evidenceUrl: z.string().optional(),
    }),
  })
  .openapi("CreateReportResponse");
export type CreateReportInput = z.infer<typeof createReportInputSchema>;
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;

export const getReportResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      ticketId: z.string(),
      violationDate: z.string(),
      description: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      adminNotes: z.string().nullable().optional(),
      merchantName: z.string(),
      merchantCity: z.string().nullable().optional(),
      merchantAddress: z.string().nullable().optional(),
      evidenceUrl: z.string().nullable().optional(),
    }),
  })
  .openapi("GetReportResponse");

export type GetReportResponse = z.infer<typeof getReportResponseSchema>;

export const getMyReportsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        ticketId: z.string(),
        merchantName: z.string(),
        violationCategory: z.string().optional(),
        createdAt: z.string(),
        status: z.string(),
      }),
    ),
  })
  .openapi("GetMyReportsResponse");

export type GetMyReportsResponse = z.infer<typeof getMyReportsResponseSchema>;

// Admin Dashboard metrics
export const dashboardMetricsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      totalReports: z.object({ value: z.number(), trend: z.number() }),
      pendingVerification: z.object({ value: z.number(), trend: z.number() }),
      investigationActive: z.object({ value: z.number(), trend: z.number() }),
      resolvedReports: z.object({ value: z.number(), trend: z.number() }),
    }),
  })
  .openapi("DashboardMetricsResponse");

export type DashboardMetricsResponse = z.infer<
  typeof dashboardMetricsResponseSchema
>;

// Admin reports list
export const adminGetReportsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(
      z.object({
        id: z.string().uuid(),
        ticketId: z.string(),
        violationCategory: z.string().nullable().optional(),
        merchantName: z.string(),
        merchantCity: z.string().nullable().optional(),
        status: z.string(),
        createdAt: z.string(),
      }),
    ),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("AdminGetReportsResponse");

export type AdminGetReportsResponse = z.infer<
  typeof adminGetReportsResponseSchema
>;

// Admin report detail
export const adminGetReportDetailResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.string().uuid(),
      ticketId: z.string(),
      violationDate: z.string(),
      description: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      adminNotes: z.string().nullable().optional(),
      merchant: z.object({
        id: z.string().uuid(),
        name: z.string(),
        city: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
      }),
      reporter: z.object({
        name: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        isAnonymous: z.boolean(),
      }),
      evidences: z.array(
        z.object({
          id: z.string().uuid(),
          fileUrl: z.string(),
          fileType: z.string().nullable().optional(),
          fileName: z.string().nullable().optional(),
        }),
      ),
      history: z.array(
        z.object({
          id: z.string().uuid(),
          oldStatus: z.string(),
          newStatus: z.string(),
          notes: z.string().nullable().optional(),
          createdAt: z.string(),
          actorName: z.string(),
        }),
      ),
    }),
  })
  .openapi("AdminGetReportDetailResponse");

export type AdminGetReportDetailResponse = z.infer<
  typeof adminGetReportDetailResponseSchema
>;

// Update status
export const updateReportStatusInputSchema = z
  .object({
    status: z.enum([
      "draft",
      "submitted",
      "in_review",
      "verified",
      "rejected",
      "resolved",
    ]),
    notes: z.string().optional(),
  })
  .openapi("UpdateReportStatusInput");

export type UpdateReportStatusInput = z.infer<
  typeof updateReportStatusInputSchema
>;

export const updateReportStatusResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.string().uuid(),
      status: z.string(),
      updatedAt: z.string(),
    }),
  })
  .openapi("UpdateReportStatusResponse");

export type UpdateReportStatusResponse = z.infer<
  typeof updateReportStatusResponseSchema
>;

// Update internal notes
export const updateInternalNotesInputSchema = z
  .object({
    notes: z.string().min(1, "Catatan internal tidak boleh kosong"),
  })
  .openapi("UpdateInternalNotesInput");

export type UpdateInternalNotesInput = z.infer<
  typeof updateInternalNotesInputSchema
>;

export const updateInternalNotesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      id: z.string().uuid(),
      adminNotes: z.string().nullable().optional(),
      updatedAt: z.string(),
    }),
  })
  .openapi("UpdateInternalNotesResponse");

export type UpdateInternalNotesResponse = z.infer<
  typeof updateInternalNotesResponseSchema
>;
