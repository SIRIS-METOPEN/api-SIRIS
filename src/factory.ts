import { createFactory } from "hono/factory";
import type { Env } from "./env";

export interface AppEnv {
  Bindings: Env;
  Variables: {
    user: import("better-auth").User | null;
    session: import("better-auth").Session | null;
  };
}

export const factory = createFactory<AppEnv>();

export function createRouter() {
  return factory.createApp();
}