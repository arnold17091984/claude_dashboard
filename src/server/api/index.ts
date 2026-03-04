import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { overviewRoute } from "./routes/overview";
import { ingestRoute } from "./routes/ingest";
import { rankingRoute } from "./routes/ranking";
import { usersRoute } from "./routes/users";
import { toolsRoute } from "./routes/tools";
import { modelsRoute } from "./routes/models";
import { sessionsRoute } from "./routes/sessions";
import { aiInsightsRoute } from "./routes/ai-insights";
import { projectsRoute } from "./routes/projects";
import { timingMiddleware } from "./middleware/timing";

const app = new Hono().basePath("/api/v1");

// Compress JSON responses (gzip / deflate based on Accept-Encoding)
app.use("*", compress());

// CORS for browser clients
app.use("*", cors());

// Request duration logging — slow queries (>500ms) are emitted as WARN
app.use("*", timingMiddleware);

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
