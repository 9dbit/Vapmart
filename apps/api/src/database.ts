import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool | null = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
    : null;

  get configured(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string, values: unknown[] = []
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new ServiceUnavailableException({ code: 'DATABASE_NOT_CONFIGURED' });
    }
    return this.pool.query<T>(sql, values);
  }

  async transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
    if(!this.pool)throw new ServiceUnavailableException({code:'DATABASE_NOT_CONFIGURED'});
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const result=await work(client);
      await client.query('COMMIT');
      return result;
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{client.release();}
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
