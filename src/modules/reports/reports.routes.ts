import { createRouter } from "../../factory";
import { createRoute } from "@hono/zod-openapi";
import * as handlers from "./reports.handlers";
import * as s from "./reports.schema";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { z } from "@hono/zod-openapi";

const router = createRouter();

const errorResponseSchema = z
  .object({
    message: z.string(),
    data: z.array(z.string()).optional(),
  })
  .openapi("ErrorResponse");

export const createReportRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: s.createReportInputSchema,
        },
      },
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: {
      content: {
        "application/json": {
          schema: s.createReportResponseSchema,
        },
      },
      description: "Report created successfully",
    },
    [HttpStatusCodes.BAD_REQUEST]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Validation error or invalid request payload",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const getReportRoute = createRoute({
  method: "get",
  path: "/:ticketId{SRS-[0-9]{4}-[A-Za-z0-9]+}",
  request: {
    params: z.object({
      ticketId: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.getReportResponseSchema,
        },
      },
      description: "Report details retrieved successfully",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Report not found",
    },
    [HttpStatusCodes.BAD_REQUEST]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Validation error or invalid ticketId",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const getMyReportsRoute = createRoute({
  method: "get",
  path: "/me",
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.getMyReportsResponseSchema,
        },
      },
      description: "List of reports belonging to the current logged-in user",
    },
    [HttpStatusCodes.UNAUTHORIZED]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "User is not logged in",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

router.openapi(createReportRoute, handlers.createReportHandler);
router.openapi(getMyReportsRoute, handlers.getMyReportsHandler);
router.openapi(getReportRoute, handlers.getReportHandler);

// Admin Middlewares
import { adminMiddleware } from "../../middlewares/auth";

const adminErrorResponses = {
  [HttpStatusCodes.FORBIDDEN]: {
    content: { "application/json": { schema: errorResponseSchema } },
    description: "Forbidden",
  },
  [HttpStatusCodes.UNAUTHORIZED]: {
    content: { "application/json": { schema: errorResponseSchema } },
    description: "Unauthorized",
  },
  [HttpStatusCodes.INTERNAL_SERVER_ERROR]: {
    content: { "application/json": { schema: errorResponseSchema } },
    description: "Internal server error",
  },
};

export const adminGetReportsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.adminGetReportsResponseSchema,
        },
      },
      description: "Admin reports list retrieved successfully",
    },
    ...adminErrorResponses,
  },
});

export const adminGetReportDetailRoute = createRoute({
  method: "get",
  path: "/:id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.adminGetReportDetailResponseSchema,
        },
      },
      description: "Admin report detail retrieved successfully",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Report not found",
    },
    ...adminErrorResponses,
  },
});

export const updateReportStatusRoute = createRoute({
  method: "patch",
  path: "/:id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}/status",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: s.updateReportStatusInputSchema,
        },
      },
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.updateReportStatusResponseSchema,
        },
      },
      description: "Report status updated successfully",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Report not found",
    },
    ...adminErrorResponses,
  },
});

export const updateInternalNotesRoute = createRoute({
  method: "post",
  path: "/:id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}/internal-notes",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: s.updateInternalNotesInputSchema,
        },
      },
    },
  },
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.updateInternalNotesResponseSchema,
        },
      },
      description: "Report internal notes updated successfully",
    },
    [HttpStatusCodes.NOT_FOUND]: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Report not found",
    },
    ...adminErrorResponses,
  },
});

// Protect admin list reports (GET /)
router.get("/", adminMiddleware);

// Protect admin details, status, and internal-notes (routes containing UUID)
router.use(
  "/:id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}",
  adminMiddleware,
);
router.use(
  "/:id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}/*",
  adminMiddleware,
);

router.openapi(adminGetReportsRoute, handlers.adminGetReportsHandler);
router.openapi(adminGetReportDetailRoute, handlers.adminGetReportDetailHandler);
router.openapi(updateReportStatusRoute, handlers.updateReportStatusHandler);
router.openapi(updateInternalNotesRoute, handlers.updateInternalNotesHandler);

// Dashboard metrics router
const dashboardRouter = createRouter();

// Protect all dashboard metrics endpoints
dashboardRouter.use("*", adminMiddleware);

export const getDashboardMetricsRoute = createRoute({
  method: "get",
  path: "/metrics",
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        "application/json": {
          schema: s.dashboardMetricsResponseSchema,
        },
      },
      description: "Dashboard metrics compiled successfully",
    },
    ...adminErrorResponses,
  },
});

dashboardRouter.openapi(
  getDashboardMetricsRoute,
  handlers.getDashboardMetricsHandler,
);

export { router as reportsRouter, dashboardRouter };
