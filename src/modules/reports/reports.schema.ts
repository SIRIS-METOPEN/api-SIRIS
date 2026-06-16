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
