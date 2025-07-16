import type { Hono, Env } from "hono";
import type { BlankSchema } from "hono/types";
import searchRoute from "./searchRoute";

export interface RouterMW {
  path: string;
  router: Hono<Env, BlankSchema, "/">;
}

export const routers: RouterMW[] = [
  {
    path: "/search",
    router: searchRoute,
  },
];
