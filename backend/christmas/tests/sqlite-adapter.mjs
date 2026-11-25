// Test-only D1 API shape backed by Node SQLite. This is NOT a D1 emulator.
export class SQLiteAdapter {
  constructor(db) { this.db = db; }
  prepare(sql) {
    const db = this.db;
    return { bind(...values) {
      return {
        async first() { return db.prepare(sql).get(...values) || null; },
        async all() { return { results: db.prepare(sql).all(...values) }; },
        async run() {
          const statement = db.prepare(sql);
          if (statement.columns().length === 0) {
            return { results: [], meta: { changes: statement.run(...values).changes } };
          }
          const results = statement.all(...values);
          const changes = /\bRETURNING\b/i.test(sql) ? db.prepare('SELECT changes() AS count').get().count : 0;
          return { results, meta: { changes } };
        }
      };
    } };
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.db.exec('COMMIT'); return results; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
