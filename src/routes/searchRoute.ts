import { Hono } from "hono";
import { searchController } from "../controllers";

const app = new Hono();

app.post("/", (c) => searchController.search(c));

export default app;
