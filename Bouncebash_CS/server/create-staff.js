require('dotenv').config();

const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { createDatabase } = require('./database');
const { passwordSchema } = require('./validation');

async function readHidden(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error('Staff setup must run from an interactive terminal.');
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const onData = chunk => {
      const character = chunk.toString('utf8');
      if (character === '\u0003') {
        cleanup();
        reject(new Error('Staff setup cancelled.'));
      } else if (character === '\r' || character === '\n') {
        cleanup();
        stdout.write('\n');
        resolve(value);
      } else if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1);
      } else if (character >= ' ' && character <= '~') {
        value += character;
      }
    };
    stdin.on('data', onData);
  });
}

async function createInitialStaffAccount(db, input) {
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().max(254),
    password: passwordSchema(14)
  }).safeParse(input);
  if (!parsed.success) throw new Error('Provide a valid name, email, and password of 14 to 72 characters.');
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const insert = db.transaction(() => {
    if (db.prepare('SELECT COUNT(*) AS count FROM staff_users').get().count !== 0) {
      throw new Error('Initial staff setup is only available before the first staff account exists.');
    }
    db.prepare(`INSERT INTO staff_users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')`).run(parsed.data.name, parsed.data.email, passwordHash);
  });
  insert.immediate();
  return parsed.data.email;
}

async function main() {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  let db;
  try {
    const name = (await terminal.question('Staff name: ')).trim();
    const email = (await terminal.question('Staff email: ')).trim().toLowerCase();
    terminal.close();
    const password = await readHidden('Staff password (14+ characters): ');
    db = createDatabase(process.env.DATABASE_PATH || './data/bouncebash.sqlite');
    const createdEmail = await createInitialStaffAccount(db, { name, email, password });
    console.log(`Initial administrator created for ${createdEmail}.`);
  } finally {
    terminal.close();
    db?.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createInitialStaffAccount };
