import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH =
  process.env.DATABASE_URL ||
  path.join(process.cwd(), "data", "dashboard.db");

const sqlite = new Database(DB_PATH);

// Durability and correctness
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Read performance optimizations
sqlite.pragma("cache_size = -64000");       // 64MB page cache (default: ~2MB)
sqlite.pragma("mmap_size = 268435456");     // 256MB memory-mapped I/O
sqlite.pragma("temp_store = MEMORY");       // Keep temp tables in memory
sqlite.pragma("synchronous = NORMAL");      // Faster than FULL, safe with WAL
sqlite.pragma("page_size = 4096");          // Optimal page size for most workloads
sqlite.pragma("wal_autocheckpoint = 1000"); // Checkpoint WAL every 1000 pages

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
