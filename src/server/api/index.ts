import { Hono } from "hono";
import { cors } from "hono/cors";
import { overviewRoute } from "./routes/overview";
import { ingestRoute } from "./routes/ingest";
import { rankingRoute } from "./routes/ranking";
import { usersRoute } from "./routes/users";
import { toolsRoute } from "./routes/tools";
import { modelsRoute } from "./routes/models";
import { sessionsRoute } from "./routes/sessions";
import { aiInsightsRoute } from "./routes/ai-insights";
import { projectsRoute } from "./routes/projects";

const app = new Hono().basePath("/api/v1");

app.use("*", cors());

app.route("/overview", overviewRoute);
app.route("/ingest", ingestRoute);
app.route("/ranking", rankingRoute);
app.route("/users", usersRoute);
app.route("/tools", toolsRoute);
app.route("/models", modelsRoute);
app.route("/sessions", sessionsRoute);
app.route("/ai-insights", aiInsightsRoute);
app.route("/projects", projectsRoute);

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

export default app;
export type AppType = typeof app;
