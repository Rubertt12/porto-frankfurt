import Database from '@tauri-apps/plugin-sql';

export type LocalCondominium = {
  id: number;
  name: string;
  document: string | null;
  address: string | null;
  blocks_count: number;
  floors_per_block: number;
  apartments_per_floor: number;
  created_at: string;
};

let connection: Promise<Database> | null = null;

const schema = [
  `CREATE TABLE IF NOT EXISTS condominiums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    document TEXT,
    address TEXT,
    blocks_count INTEGER NOT NULL DEFAULT 1,
    floors_per_block INTEGER NOT NULL DEFAULT 1,
    apartments_per_floor INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    floors_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(condominium_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS apartments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    floor INTEGER NOT NULL,
    number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'vacant',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(condominium_id, block_id, number)
  )`,
  `CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    document TEXT,
    resident_type TEXT NOT NULL DEFAULT 'resident',
    is_owner INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    plate TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(condominium_id, plate)
  )`,
  `CREATE TABLE IF NOT EXISTS parking_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    space_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    notes TEXT,
    UNIQUE(condominium_id, space_code)
  )`,
  `CREATE TABLE IF NOT EXISTS common_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area_type TEXT NOT NULL DEFAULT 'other',
    capacity INTEGER,
    rules TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(condominium_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    common_area_id INTEGER NOT NULL REFERENCES common_areas(id) ON DELETE CASCADE,
    apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    reservation_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    purpose TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    carrier TEXT,
    tracking_code TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_pickup',
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TEXT,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominium_id INTEGER NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    category TEXT,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS local_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`
];

export async function getLocalDatabase() {
  if (!connection) {
    connection = (async () => {
      const db = await Database.load('sqlite:porto-frankfurt.db');
      await db.execute('PRAGMA foreign_keys = ON');
      for (const statement of schema) await db.execute(statement);
      return db;
    })();
  }
  return connection;
}

export async function listLocalCondominiums() {
  const db = await getLocalDatabase();
  return db.select<LocalCondominium[]>('SELECT * FROM condominiums ORDER BY name COLLATE NOCASE');
}

export async function createLocalCondominium(input: {
  name: string;
  document?: string;
  address?: string;
  blocksCount: number;
  floorsPerBlock: number;
  apartmentsPerFloor: number;
}) {
  const db = await getLocalDatabase();
  const result = await db.execute(
    'INSERT INTO condominiums (name, document, address, blocks_count, floors_per_block, apartments_per_floor) VALUES (?, ?, ?, ?, ?, ?)',
    [input.name.trim(), input.document || null, input.address || null, input.blocksCount, input.floorsPerBlock, input.apartmentsPerFloor]
  );
  const condominiumId = result.lastInsertId;
  for (let b = 1; b <= input.blocksCount; b++) {
    const block = await db.execute(
      'INSERT INTO blocks (condominium_id, name, floors_count) VALUES (?, ?, ?)',
      [condominiumId, `Bloco ${String.fromCharCode(64 + b)}`, input.floorsPerBlock]
    );
    for (let floor = 1; floor <= input.floorsPerBlock; floor++) {
      for (let unit = 1; unit <= input.apartmentsPerFloor; unit++) {
        const number = `${floor}${String(unit).padStart(2, '0')}`;
        await db.execute(
          'INSERT INTO apartments (condominium_id, block_id, floor, number) VALUES (?, ?, ?, ?)',
          [condominiumId, block.lastInsertId, floor, number]
        );
      }
    }
  }
  return condominiumId;
}

export async function localDashboardStats(condominiumId: number) {
  const db = await getLocalDatabase();
  const tables = ['apartments', 'residents', 'packages', 'reservations', 'vehicles', 'occurrences'] as const;
  const values = await Promise.all(tables.map(async table => {
    const rows = await db.select<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM ${table} WHERE condominium_id = ?`,
      [condominiumId]
    );
    return rows[0]?.total ?? 0;
  }));
  return Object.fromEntries(tables.map((table, index) => [table, values[index]]));
}

export type LocalRow = Record<string, string | number | null>;

const localTableColumns: Record<string, string[]> = {
  apartments: ['block_id','floor','number','status'],
  residents: ['apartment_id','full_name','email','phone','document','resident_type','is_owner','is_active'],
  packages: ['apartment_id','recipient_name','carrier','tracking_code','status','notes'],
  reservations: ['common_area_id','apartment_id','reservation_date','start_time','end_time','status','purpose'],
  vehicles: ['apartment_id','plate','brand','model','color'],
  parking_spaces: ['apartment_id','space_code','status','notes'],
  common_areas: ['name','area_type','capacity','rules','is_active'],
  announcements: ['title','body','category','is_published'],
  occurrences: ['apartment_id','title','description','status'],
  financial_transactions: ['apartment_id','description','transaction_type','category','amount_cents','due_date','status']
};

export async function listLocalRows(table: string, condominiumId: number) {
  if (!Object.prototype.hasOwnProperty.call(localTableColumns, table)) throw new Error('Módulo local não permitido.');
  const db = await getLocalDatabase();
  return db.select<LocalRow[]>(`SELECT * FROM ${table} WHERE condominium_id = ? ORDER BY id DESC LIMIT 500`, [condominiumId]);
}

export async function saveLocalRow(table: string, condominiumId: number, row: LocalRow, id?: number) {
  const columns = localTableColumns[table];
  if (!columns) throw new Error('Módulo local não permitido.');
  const db = await getLocalDatabase();
  const values = columns.map(column => row[column] === '' ? null : row[column] ?? null);
  if (id) {
    await db.execute(`UPDATE ${table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE id = ? AND condominium_id = ?`, [...values, id, condominiumId]);
    return id;
  }
  const result = await db.execute(`INSERT INTO ${table} (condominium_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`, [condominiumId, ...values]);
  return result.lastInsertId;
}

export async function deleteLocalRow(table: string, condominiumId: number, id: number) {
  if (!Object.prototype.hasOwnProperty.call(localTableColumns, table)) throw new Error('Módulo local não permitido.');
  const db = await getLocalDatabase();
  await db.execute(`DELETE FROM ${table} WHERE id = ? AND condominium_id = ?`, [id, condominiumId]);
}

export async function listLocalOptions(condominiumId: number) {
  const db = await getLocalDatabase();
  const [apartments, blocks, areas] = await Promise.all([
    db.select<Array<{id:number; block_id:number; number:string; block_name:string}>>('SELECT a.id, a.block_id, a.number, b.name AS block_name FROM apartments a JOIN blocks b ON b.id = a.block_id WHERE a.condominium_id = ? ORDER BY b.name, a.number', [condominiumId]),
    db.select<Array<{id:number; name:string}>>('SELECT id, name FROM blocks WHERE condominium_id = ? ORDER BY name', [condominiumId]),
    db.select<Array<{id:number; name:string}>>('SELECT id, name FROM common_areas WHERE condominium_id = ? AND is_active = 1 ORDER BY name', [condominiumId])
  ]);
  return { apartments, blocks, areas };
}
