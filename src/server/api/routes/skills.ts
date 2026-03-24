import { Hono } from "hono";
import { db } from "@/server/db";
import { events, users, skillInventory } from "@/server/db/schema";
import { count, countDistinct, desc, eq, and, gte, isNotNull, ne } from "drizzle-orm";
import { apiKeyAuth } from "@/server/api/middleware/auth";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const skillsRoute = new Hono();

// GET /skills/summary?period=30d — Overall skill/subagent/tool proficiency summary
skillsRoute.get("/summary", async (c) => {
  const period = parsePeriod(c.req.query("period"));
  const since = periodToSince(period);

  // Run queries in parallel
  const [skillUsage, subagentUsage, userProficiency] = await Promise.all([
    // Top skills across all users
    db.select({
      skillName: events.skillName,
      userCount: countDistinct(events.userId),
      totalCalls: count(),
    })
    .from(events)
    .where(and(
      isNotNull(events.skillName),
      ne(events.skillName, ""),
      gte(events.timestamp, since)
    ))
    .groupBy(events.skillName)
    .orderBy(desc(count())),

    // Top subagent types
    db.select({
      subagentType: events.subagentType,
      userCount: countDistinct(events.userId),
      totalCalls: count(),
    })
    .from(events)
    .where(and(
      isNotNull(events.subagentType),
      ne(events.subagentType, ""),
      gte(events.timestamp, since)
    ))
    .groupBy(events.subagentType)
    .orderBy(desc(count())),

    // Per-user proficiency: distinct skills, distinct subagents, distinct tools
    db.select({
      userId: events.userId,
      distinctSkills: countDistinct(events.skillName),
      distinctSubagents: countDistinct(events.subagentType),
      distinctTools: countDistinct(events.toolName),
      totalCalls: count(),
    })
    .from(events)
    .where(gte(events.timestamp, since))
    .groupBy(events.userId)
    .orderBy(desc(count())),
  ]);

  // Enrich with display names
  const allUsers = db.select({ id: users.id, displayName: users.displayName }).from(users).all();
  const userMap = new Map(allUsers.map(u => [u.id, u.displayName]));

  const enrichedProficiency = userProficiency.map(u => ({
    ...u,
    displayName: userMap.get(u.userId) || u.userId,
  }));

  return c.json({
    period,
    skills: skillUsage,
    subagents: subagentUsage,
    userProficiency: enrichedProficiency,
  });
});

// GET /skills/user/:userId?period=30d — Detailed skill breakdown for a specific user
skillsRoute.get("/user/:userId", async (c) => {
  const userId = c.req.param("userId");
  const period = parsePeriod(c.req.query("period"));
  const since = periodToSince(period);

  const [userSkills, userSubagents, userTools] = await Promise.all([
    db.select({
      skillName: events.skillName,
      count: count(),
    })
    .from(events)
    .where(and(
      eq(events.userId, userId),
      isNotNull(events.skillName),
      ne(events.skillName, ""),
      gte(events.timestamp, since)
    ))
    .groupBy(events.skillName)
    .orderBy(desc(count())),

    db.select({
      subagentType: events.subagentType,
      count: count(),
    })
    .from(events)
    .where(and(
      eq(events.userId, userId),
      isNotNull(events.subagentType),
      ne(events.subagentType, ""),
      gte(events.timestamp, since)
    ))
    .groupBy(events.subagentType)
    .orderBy(desc(count())),

    db.select({
      toolName: events.toolName,
      count: count(),
    })
    .from(events)
    .where(and(
      eq(events.userId, userId),
      isNotNull(events.toolName),
      ne(events.toolName, ""),
      gte(events.timestamp, since)
    ))
    .groupBy(events.toolName)
    .orderBy(desc(count()))
    .limit(20),
  ]);

  // User info
  const userInfo = db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)).all();

  // Also fetch installed inventory for this user
  const installed = db
    .select({ type: skillInventory.type, count: count() })
    .from(skillInventory)
    .where(eq(skillInventory.userId, userId))
    .groupBy(skillInventory.type)
    .all();

  const inventoryMap: Record<string, number> = {};
  for (const row of installed) {
    inventoryMap[row.type] = row.count;
  }

  return c.json({
    userId,
    displayName: userInfo[0]?.displayName || userId,
    period,
    skills: userSkills,
    subagents: userSubagents,
    topTools: userTools,
    summary: {
      totalSkills: userSkills.length,
      totalSubagents: userSubagents.length,
      totalDistinctTools: userTools.length,
    },
    installed: {
      commands: inventoryMap.command || 0,
      skills: inventoryMap.skill || 0,
      agents: inventoryMap.agent || 0,
      total: Object.values(inventoryMap).reduce((a, b) => a + b, 0),
    },
  });
});

// POST /skills/inventory — Sync installed skills/commands/agents from user machine
skillsRoute.post("/inventory", apiKeyAuth, async (c) => {
  const body = await c.req.json();
  const userId = body.userId;
  const items = body.items;

  if (!userId || !Array.isArray(items)) {
    return c.json({ error: "userId and items[] required" }, 400);
  }

  // Clear old inventory for this user and replace
  db.transaction((tx) => {
    tx.delete(skillInventory).where(eq(skillInventory.userId, userId)).run();

    const now = new Date().toISOString();
    for (const item of items) {
      if (item.name && item.type) {
        tx.insert(skillInventory).values({
          userId,
          name: item.name,
          type: item.type,
          syncedAt: now,
        }).run();
      }
    }
  });

  // Return summary
  const summary = db
    .select({ type: skillInventory.type, count: count() })
    .from(skillInventory)
    .where(eq(skillInventory.userId, userId))
    .groupBy(skillInventory.type)
    .all();

  return c.json({
    synced: true,
    userId,
    inventory: Object.fromEntries(summary.map(r => [r.type, r.count])),
  });
});

// GET /skills/inventory?userId=xxx — Get installed inventory for a user
skillsRoute.get("/inventory", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    // Return all users' inventory summaries
    const all = db
      .select({
        userId: skillInventory.userId,
        type: skillInventory.type,
        count: count(),
      })
      .from(skillInventory)
      .groupBy(skillInventory.userId, skillInventory.type)
      .all();

    // Group by user
    const byUser: Record<string, Record<string, number>> = {};
    for (const row of all) {
      if (!byUser[row.userId]) byUser[row.userId] = {};
      byUser[row.userId][row.type] = row.count;
    }

    // Enrich with display names
    const allUsers = db.select({ id: users.id, displayName: users.displayName }).from(users).all();
    const userMap = new Map(allUsers.map(u => [u.id, u.displayName]));

    const result = Object.entries(byUser).map(([uid, inv]) => ({
      userId: uid,
      displayName: userMap.get(uid) || uid,
      commands: inv.command || 0,
      skills: inv.skill || 0,
      agents: inv.agent || 0,
      total: Object.values(inv).reduce((a, b) => a + b, 0),
    }));

    return c.json({ users: result });
  }

  // Specific user's full inventory
  const items = db
    .select({ name: skillInventory.name, type: skillInventory.type })
    .from(skillInventory)
    .where(eq(skillInventory.userId, userId))
    .orderBy(skillInventory.type, skillInventory.name)
    .all();

  return c.json({ userId, items, total: items.length });
});
