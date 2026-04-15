import { Pool, type QueryResultRow } from "pg";
import { TttConfig } from "../tttConfig";

export class DbClient {
  private readonly pool: Pool;

  constructor(tttConfig: TttConfig) {
    if (!tttConfig.dbHost) {
      throw new Error(`DB host not configured for env "${tttConfig.env}"`);
    }
    this.pool = new Pool({
      host: tttConfig.dbHost,
      port: tttConfig.dbPort,
      database: tttConfig.dbName,
      user: tttConfig.dbUsername,
      password: tttConfig.dbPassword,
      max: 2,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T> {
    const rows = await this.query<T>(sql, params);
    if (rows.length === 0) {
      throw new Error(`Expected at least one row, got 0. SQL: ${sql}`);
    }
    return rows[0];
  }

  async queryOneOrNull<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
