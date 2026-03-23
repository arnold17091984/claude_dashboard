import { Hono } from "hono";
import { cors } from "hono/cors";
import { securityHeaders } from "./middleware/security";
import { requestLogger } from "./middleware/request-logger";
import { generalRateLimit, ingestRateLimit } from "./middleware/rate-limit";
import { timingMiddleware } from "./middleware/timing";
import { overviewRoute } from "./routes/overview";
import { ingestRoute } from "./routes/ingest";
import { rankingRoute } from "./routes/ranking";
import { usersRoute } from "./routes/users";
import { toolsRoute } from "./routes/tools";
import { modelsRoute } from "./routes/models";
import { sessionsRoute } from "./routes/sessions";
import { aiInsightsRoute } from "./routes/ai-insights";
import { projectsRoute } from "./routes/projects";
import { healthRoute } from "./routes/health";

const app = new Hono().basePath("/api/v1");

// ---------------------------------------------------------------------------
// Global middleware (applied in order)
// ---------------------------------------------------------------------------

// 1. Request logging — captures method, path, status, duration
app.use("*", requestLogger);

// 2. Security headers — CSP, HSTS, X-Frame-Options, etc.
app.use("*", securityHeaders);

// 3. CORS
app.use("*", cors());

// 4. Request duration logging — slow queries (>500ms) are emitted as WARN
app.use("*", timingMiddleware);

// 5. Rate limiting — tiered by route
//    Ingest routes get a separate, more generous limit (100/min).
//    The ingest route itself also applies apiKeyAuth internally.
app.use("/ingest/*", ingestRateLimit);

//    General API routes: 200 requests per minute.
//    AI insight rate limiting is applied per-route in ai-insights.ts.
app.use("*", generalRateLimit);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route("/overview", overviewRoute);
app.route("/ingest", ingestRoute);
app.route("/ranking", rankingRoute);
app.route("/users", usersRoute);
app.route("/tools", toolsRoute);
app.route("/models", modelsRoute);
app.route("/sessions", sessionsRoute);
app.route("/ai-insights", aiInsightsRoute);
app.route("/projects", projectsRoute);
app.route("/health", healthRoute);

// Basic liveness check (kept for backwards-compatibility)
app.get("/ping", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

export default app;
export type AppType = typeof app;
