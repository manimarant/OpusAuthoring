import dotenv from "dotenv";
import { Pool as NodePgPool } from 'pg';
import { drizzle as nodePgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";

// Load environment variables from .env file
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function isLocalDatabaseUrl(connectionString: string) {
  return /@(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(connectionString);
}

function isNeonDatabaseUrl(connectionString: string) {
  return /(?:^|@)[^/\s]+\.neon\.tech(?::\d+)?(?:\/|$)/i.test(connectionString);
}

function getConnectionTimeoutMs() {
  const configuredTimeout = Number(process.env.PG_CONNECTION_TIMEOUT_MS);
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  // Remote serverless databases can take a few seconds to wake up.
  return process.env.VERCEL ? 15000 : 5000;
}

const isLocalDatabase = isLocalDatabaseUrl(process.env.DATABASE_URL);
const useNeonServerless = Boolean(process.env.VERCEL) && isNeonDatabaseUrl(process.env.DATABASE_URL);

// Use Neon serverless driver on Vercel when the DB URL is a Neon endpoint.
export const pool: NodePgPool | NeonPool = useNeonServerless
  ? new NeonPool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: getConnectionTimeoutMs(),
    })
  : new NodePgPool({
      connectionString: process.env.DATABASE_URL,
      max: process.env.VERCEL ? 1 : 10,
      idleTimeoutMillis: process.env.VERCEL ? 5000 : 30000,
      connectionTimeoutMillis: getConnectionTimeoutMs(),
      keepAlive: true,
      ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
    });

// Handle pool errors
(pool as NodePgPool).on('error', (err: Error) => {
  console.error('Database pool error:', err);
});

export const db = useNeonServerless
  ? neonDrizzle(pool as NeonPool, { schema })
  : nodePgDrizzle(pool as NodePgPool, { schema });
