import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://trustwheels_user:xuUPph3Zy4bXGWvMhoen@localhost:5432/trustwheels_db01',
});
