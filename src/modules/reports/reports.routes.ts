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

router.openapi(createReportRoute, handlers.createReportHandler);

export { router as reportsRouter };
