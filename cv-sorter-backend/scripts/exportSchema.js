/**
 * Exporte la STRUCTURE de la base (sans aucune donnée de candidat) dans schema_db.txt
 *   npm run db:schema
 */
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const cols = await pool.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = current_schema()
      ORDER BY table_name, ordinal_position`);
    const cons = await pool.query(`
      SELECT tc.table_name, tc.constraint_type, tc.constraint_name, string_agg(kcu.column_name, ', ') AS columns
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = current_schema() AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
      GROUP BY tc.table_name, tc.constraint_type, tc.constraint_name
      ORDER BY tc.table_name`);
    const counts = {};
    for (const t of [...new Set(cols.rows.map((r) => r.table_name))]) {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      counts[t] = r.rows[0].n;
    }

    let out = `Schéma : ${(await pool.query('SELECT current_schema() AS s')).rows[0].s}\n`;
    let current = null;
    for (const c of cols.rows) {
      if (c.table_name !== current) {
        current = c.table_name;
        out += `\n=== ${current} (${counts[current]} ligne(s)) ===\n`;
      }
      out += `  ${c.column_name}  ${c.data_type === 'ARRAY' ? c.udt_name : c.data_type}`
        + `${c.is_nullable === 'NO' ? '  NOT NULL' : ''}${c.column_default ? `  DEFAULT ${c.column_default}` : ''}\n`;
    }
    out += '\n=== Contraintes ===\n';
    for (const k of cons.rows) out += `  ${k.table_name}: ${k.constraint_type} (${k.columns})\n`;

    fs.writeFileSync('schema_db.txt', out);
    console.log('✔ Structure exportée dans schema_db.txt');
  } catch (e) {
    console.error('✖', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
