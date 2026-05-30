import {
  pgTable,
  text,
  boolean,
  timestamp,
  doublePrecision,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  password: text("password"), // nullable for OAuth users
  role: text("role", { enum: ["user", "admin"] })
    .default("user")
    .notNull(),
  phone: text("phone"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

// Better Auth tables
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: text("status", { enum: ["clear", "diawasi", "investigasi"] })
    .default("diawasi")
    .notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: text("ticketId").notNull().unique(),
  reporterId: text("reporterId").references(() => users.id, {
    onDelete: "set null",
  }),
  isAnonymous: boolean("isAnonymous").default(false).notNull(),
  reporterName: text("reporterName"),
  reporterPhone: text("reporterPhone"),
  merchantId: uuid("merchantId").references(() => merchants.id, {
    onDelete: "set null",
  }),
  violationDate: timestamp("violationDate").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: [
      "draft",
      "submitted",
      "in_review",
      "verified",
      "rejected",
      "resolved",
    ],
  })
    .default("submitted")
    .notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const reportEvidences = pgTable("report_evidences", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("reportId")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  fileUrl: text("fileUrl").notNull(),
  fileType: text("fileType"),
  fileName: text("fileName"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
