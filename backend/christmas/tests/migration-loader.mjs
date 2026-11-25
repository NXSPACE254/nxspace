import assert from 'node:assert/strict';
// Format-specific parser for checked-in migrations, NOT a generic SQL parser.
// D1.exec splits by newline; retain multiline CREATE TRIGGER as one statement.
export function migrationStatements(sql) {
  const statements = []; let current = '';
  for (const raw of sql.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('--')) continue;
    current += `${line}\n`;
    const trigger = current.startsWith('CREATE TRIGGER');
    if (trigger ? /^(?:END;|BEGIN .* END;|CREATE TRIGGER .* END;)$/.test(line) : line.endsWith(';')) { statements.push(current.trim()); current = ''; }
  }
  assert.equal(current, '', 'Migration must contain complete statements');
  return statements;
}
