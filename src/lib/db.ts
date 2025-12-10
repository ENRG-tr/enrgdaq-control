import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/enrgdaq_control';

// For query purposes
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

export default db;
