import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { 
  Voter, 
  VotingSession, 
  VoterSessionState, 
  SessionHistoryItem, 
  SessionOutcome,
  MeetingItem,
  RealtimeNotification,
  VoterList
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'medivote.sqlite');

let db: Database;

// 31 unique voters from CA, CC, and BUREAU lists
export const INITIAL_VOTERS: Array<Omit<Voter, 'id'> & { id: string; listCodes: string[] }> = [
  { id: 'voter_schlosser', name: 'Benoit Pie SCHLOSSER', title: 'M.', specialty: 'Administrateur CA & Bureau', department: 'Goodyear', email: 'benoitpie_SCHLOSSER@goodyear.com', weight: 1, avatarColor: '#0284c7', isActive: true, seatNumber: 1, listCodes: ['CA', 'BUREAU'] },
  { id: 'voter_cagnot', name: 'Bill CAGNOT', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'SSTI', email: 'billcagnot@gmail.com', weight: 1, avatarColor: '#059669', isActive: true, seatNumber: 2, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_lot', name: 'Caroline LOT', title: 'Mme', specialty: 'Administratrice CA', department: 'Conseil d\'Administration', email: 'caroline.lot.03@gmail.com', weight: 1, avatarColor: '#d97706', isActive: true, seatNumber: 3, listCodes: ['CA'] },
  { id: 'voter_clavon', name: 'Céline CLAVON', title: 'Mme', specialty: 'Administratrice CA', department: 'Laporte & Associés', email: 'cclavon@laporte-associes.fr', weight: 1, avatarColor: '#7c3aed', isActive: true, seatNumber: 4, listCodes: ['CA'] },
  { id: 'voter_dupit', name: 'Christophe DUPIT', title: 'M.', specialty: 'Administrateur CA', department: 'Auverco', email: 'cdupit@auverco.com', weight: 1, avatarColor: '#2563eb', isActive: true, seatNumber: 5, listCodes: ['CA'] },
  { id: 'voter_furberg', name: 'Claude FURBERG', title: 'M.', specialty: 'Membre CA & CC', department: 'Direction', email: 'claude.elisa@gmail.com', weight: 1, avatarColor: '#0d9488', isActive: true, seatNumber: 6, listCodes: ['CA', 'CC'] },
  { id: 'voter_deroover', name: 'Corinne DE ROOVER', title: 'Mme', specialty: 'Administratrice CA', department: 'Conseil d\'Administration', email: 'loic.deroover@orange.fr', weight: 1, avatarColor: '#e11d48', isActive: true, seatNumber: 7, listCodes: ['CA'] },
  { id: 'voter_cury', name: 'Philippe CURY', title: 'M.', specialty: 'Administrateur CA', department: 'Bosch France', email: 'philippe.cury@fr.bosch.com', weight: 1, avatarColor: '#4f46e5', isActive: true, seatNumber: 8, listCodes: ['CA'] },
  { id: 'voter_remeau', name: 'Didier REMEAU', title: 'M.', specialty: 'Administrateur CA', department: 'SARL Remmeau', email: 'contact@sarlremmeau.com', weight: 1, avatarColor: '#0891b2', isActive: true, seatNumber: 9, listCodes: ['CA'] },
  { id: 'voter_cypres', name: 'Eléonore Cyprès', title: 'Mme', specialty: 'Administratrice CA', department: 'Accore Groupe', email: 'ecypres@accore-grp.com', weight: 1, avatarColor: '#c026d3', isActive: true, seatNumber: 10, listCodes: ['CA'] },
  { id: 'voter_masquelier', name: 'Eric MASQUELIER', title: 'M.', specialty: 'Administrateur CA', department: 'ACC 03', email: 'e.masquelier@acc03.fr', weight: 1, avatarColor: '#ea580c', isActive: true, seatNumber: 11, listCodes: ['CA'] },
  { id: 'voter_bouiller', name: 'Franck BOUILLER', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'SSTI 03', email: 'f.bouiller@ssti03.fr', weight: 1, avatarColor: '#16a34a', isActive: true, seatNumber: 12, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_dichamps', name: 'Franck DICHAMPS', title: 'M.', specialty: 'Administrateur CA', department: 'Conseil d\'Administration', email: 'franckdichamps@gmail.com', weight: 1, avatarColor: '#4338ca', isActive: true, seatNumber: 13, listCodes: ['CA'] },
  { id: 'voter_mazur', name: 'Gaelle MAZUR', title: 'Mme', specialty: 'Administratrice CA, CC & Bureau', department: 'SSTI 03', email: 'g.mazur@ssti03.fr', weight: 1, avatarColor: '#059669', isActive: true, seatNumber: 14, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_fayet', name: 'Isabelle FAYET', title: 'Mme', specialty: 'Administratrice CA & Bureau', department: 'Auvergne Marée / SSTI', email: 'direction@auvergnemaree.com', weight: 1, avatarColor: '#db2777', isActive: true, seatNumber: 15, listCodes: ['CA', 'BUREAU'] },
  { id: 'voter_feydel', name: 'Isabelle FEYDEL', title: 'Mme', specialty: 'Administratrice CA & CC', department: 'Conseil d\'Administration', email: 'isabelle-feydel@orange.fr', weight: 1, avatarColor: '#9333ea', isActive: true, seatNumber: 16, listCodes: ['CA', 'CC'] },
  { id: 'voter_buvat', name: 'Jean-Marc BUVAT', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'Direction', email: 'jeanmarcbuvat@gmail.com', weight: 1, avatarColor: '#0d9488', isActive: true, seatNumber: 17, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_chassagne', name: 'Ka Youa CHASSAGNE', title: 'Mme', specialty: 'Administratrice CA', department: 'Safran Group', email: 'ka-youa.chassagne@safrangroup.com', weight: 1, avatarColor: '#ca8a04', isActive: true, seatNumber: 18, listCodes: ['CA'] },
  { id: 'voter_combemorel', name: 'Nicolas COMBEMOREL', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'Les Mousquetaires', email: 'Nicolas.combemorel-adh@mousquetaires.com', weight: 1, avatarColor: '#2563eb', isActive: true, seatNumber: 19, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_joannet', name: 'Olivier JOANNET', title: 'M.', specialty: 'Administrateur CA', department: 'Accore Groupe', email: 'ojoannet@accore-grp.com', weight: 1, avatarColor: '#475569', isActive: true, seatNumber: 20, listCodes: ['CA'] },
  { id: 'voter_cartelier', name: 'Sarah CARTELIER', title: 'Mme', specialty: 'Administratrice CA & CC', department: 'Chronos Jobs', email: 's.cartelier@chronos.jobs', weight: 1, avatarColor: '#e11d48', isActive: true, seatNumber: 21, listCodes: ['CA', 'CC'] },
  { id: 'voter_tonneaux', name: 'Sophie TONNEAUX', title: 'Mme', specialty: 'Administratrice CA & Bureau', department: 'SSTI 03', email: 'tonneaux.sophieide@gmail.com', weight: 1, avatarColor: '#10b981', isActive: true, seatNumber: 22, listCodes: ['CA', 'BUREAU'] },
  { id: 'voter_roddier', name: 'Sylvie Roddier', title: 'Mme', specialty: 'Administratrice CA, CC & Bureau', department: 'SSTI 03', email: 's.roddier@ssti03.fr', weight: 1, avatarColor: '#0891b2', isActive: true, seatNumber: 23, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_jouannet', name: 'Thierry JOUANNET', title: 'M.', specialty: 'Membre CA & CC', department: 'Conseil d\'Administration', email: 'thierry.tjo@outlook.fr', weight: 1, avatarColor: '#6366f1', isActive: true, seatNumber: 24, listCodes: ['CA', 'CC'] },
  { id: 'voter_leveau', name: 'Xavier LEVEAU', title: 'M.', specialty: 'Administrateur CA', department: 'Groupe Séché', email: 'x.leveau@groupe-seche.com', weight: 1, avatarColor: '#d97706', isActive: true, seatNumber: 25, listCodes: ['CA'] },
  // Specific CC Members
  { id: 'voter_avignon', name: 'Gilles AVIGNON', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Safran Group', email: 'gilles.avignon@safrangroup.com', weight: 1, avatarColor: '#0284c7', isActive: true, seatNumber: 26, listCodes: ['CC'] },
  { id: 'voter_mallot', name: 'Cyrielle MALLOT', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'cyriellemallot2010@gmail.com', weight: 1, avatarColor: '#7c3aed', isActive: true, seatNumber: 27, listCodes: ['CC'] },
  { id: 'voter_vuylsteke', name: 'David VUYLSTEKE', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'david03700@hotmail.fr', weight: 1, avatarColor: '#2563eb', isActive: true, seatNumber: 28, listCodes: ['CC'] },
  { id: 'voter_grissonnanche', name: 'Valérie GRISSONNANCHE', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'grissonnanche03@gmail.com', weight: 1, avatarColor: '#e11d48', isActive: true, seatNumber: 29, listCodes: ['CC'] },
  { id: 'voter_vincent', name: 'Laure VINCENT', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'MEDEF Allier', email: 'laure.vincent@medef-allier.com', weight: 1, avatarColor: '#0d9488', isActive: true, seatNumber: 30, listCodes: ['CC'] },
  { id: 'voter_esbelin', name: 'Morgan ESBELIN', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Adhap Services', email: 'm.esbelin@adhapservices.eu', weight: 1, avatarColor: '#ea580c', isActive: true, seatNumber: 31, listCodes: ['CC'] },
];

const INITIAL_VOTER_LISTS: VoterList[] = [
  {
    id: 'list_ca',
    name: 'Conseil d\'Administration (CA)',
    code: 'CA',
    description: '25 administrateurs siégeant au Conseil d\'Administration',
    voterIds: [
      'voter_schlosser', 'voter_cagnot', 'voter_lot', 'voter_clavon', 'voter_dupit', 
      'voter_furberg', 'voter_deroover', 'voter_cury', 'voter_remeau', 'voter_cypres', 
      'voter_masquelier', 'voter_bouiller', 'voter_dichamps', 'voter_mazur', 'voter_fayet', 
      'voter_feydel', 'voter_buvat', 'voter_chassagne', 'voter_combemorel', 'voter_joannet', 
      'voter_cartelier', 'voter_tonneaux', 'voter_roddier', 'voter_jouannet', 'voter_leveau'
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'list_cc',
    name: 'Commission de Contrôle (CC)',
    code: 'CC',
    description: '16 membres de la Commission de Contrôle',
    voterIds: [
      'voter_avignon', 'voter_cagnot', 'voter_furberg', 'voter_mallot', 'voter_vuylsteke', 
      'voter_bouiller', 'voter_mazur', 'voter_grissonnanche', 'voter_feydel', 'voter_buvat', 
      'voter_vincent', 'voter_esbelin', 'voter_combemorel', 'voter_cartelier', 'voter_roddier', 
      'voter_jouannet'
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'list_bureau',
    name: 'Bureau',
    code: 'BUREAU',
    description: '9 membres siégeant au Bureau exécutif',
    voterIds: [
      'voter_schlosser', 'voter_cagnot', 'voter_bouiller', 'voter_mazur', 'voter_fayet', 
      'voter_buvat', 'voter_combemorel', 'voter_tonneaux', 'voter_roddier'
    ],
    createdAt: new Date().toISOString()
  }
];

const INITIAL_MEETINGS = [
  {
    id: 'session_ca_1',
    ref: 'CA-2026-08/R1',
    title: 'Délibération du Conseil d\'Administration - Plan d\'Orientation Stratégique',
    motion: 'Article 1.1 - Approbation du plan d\'orientation stratégique et des délibérations budgétaires présentées lors de la séance plénière du Conseil d\'Administration.',
    date: new Date().toISOString().split('T')[0],
    time: '14:30',
    location: 'Saint-Victor',
    status: 'open' as const,
    majority: 'simple' as const,
    quorum: 0, // Default: no minimum quorum
    isSecret: false,
    isActiveMeeting: true,
    activeListCode: 'CA',
    attendeeIds: INITIAL_VOTER_LISTS[0].voterIds
  },
  {
    id: 'session_cc_1',
    ref: 'CC-2026-08/R1',
    title: 'Commission de Contrôle - Validation du Rapport Annuel',
    motion: 'Article 2.3 - Validation et arrêté des comptes par les membres de la Commission de Contrôle après audit d\'exercice.',
    date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    time: '10:00',
    location: 'Moulins',
    status: 'draft' as const,
    majority: 'simple' as const,
    quorum: 0, // Default: no minimum quorum
    isSecret: false,
    isActiveMeeting: false,
    activeListCode: 'CC',
    attendeeIds: INITIAL_VOTER_LISTS[1].voterIds
  },
  {
    id: 'session_bur_1',
    ref: 'BUR-2026-08/R1',
    title: 'Réunion du Bureau - Délibération sur les Décisions d\'Urgence',
    motion: 'Article 3.1 - Vote sur les décisions d\'urgence soumises aux membres du Bureau exécutif.',
    date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    time: '17:00',
    location: 'Vichy',
    status: 'draft' as const,
    majority: 'simple' as const,
    quorum: 0, // Default: no minimum quorum
    isSecret: false,
    isActiveMeeting: false,
    activeListCode: 'BUREAU',
    attendeeIds: INITIAL_VOTER_LISTS[2].voterIds
  }
];

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      specialty TEXT,
      department TEXT,
      email TEXT,
      weight INTEGER DEFAULT 1,
      avatar_color TEXT,
      is_active INTEGER DEFAULT 1,
      seat_number INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS voter_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      voter_ids TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL,
      title TEXT NOT NULL,
      motion_text TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'open',
      majority_required TEXT DEFAULT 'simple',
      quorum_pct REAL DEFAULT 0.0,
      is_secret INTEGER DEFAULT 0,
      outcome TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      closed_at TEXT,
      is_current_active INTEGER DEFAULT 0,
      selected_attendee_ids TEXT,
      active_list_code TEXT
    );

    CREATE TABLE IF NOT EXISTS session_voter_states (
      session_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      presence TEXT DEFAULT 'present',
      proxy_to_id TEXT,
      vote_choice TEXT DEFAULT 'pending',
      voted_at TEXT,
      note TEXT,
      PRIMARY KEY (session_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS sessions_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      title TEXT NOT NULL,
      motion_text TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      location TEXT,
      total_eligible INTEGER,
      total_present INTEGER,
      quorum_reached INTEGER,
      quorum_pct REAL,
      votes_for INTEGER,
      votes_against INTEGER,
      votes_abstain INTEGER,
      total_cast INTEGER,
      majority_required TEXT,
      outcome TEXT,
      closed_at TEXT NOT NULL,
      detailed_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events_log (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      voter_name TEXT,
      vote_choice TEXT,
      session_id TEXT,
      outcome TEXT
    );

    CREATE TABLE IF NOT EXISTS motion_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      motion_text TEXT NOT NULL,
      majority_required TEXT DEFAULT 'simple',
      quorum_pct REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Migration: Add columns if they do not exist
  try { db.run(`ALTER TABLE sessions ADD COLUMN is_current_active INTEGER DEFAULT 0;`); } catch (_) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN selected_attendee_ids TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN active_list_code TEXT;`); } catch (_) {}
  // Ensure closed sessions never remain marked as current active
  try { db.run(`UPDATE sessions SET is_current_active = 0 WHERE status = 'closed';`); } catch (_) {}

  // Check if legacy demo voters (like Alexandre Roche) or empty voters exist
  const sampleVoter = db.exec("SELECT name FROM voters LIMIT 1");
  const isLegacyDemo = sampleVoter.length && sampleVoter[0].values.length && sampleVoter[0].values[0][0] === 'Alexandre Roche';
  const voterCountRes = db.exec("SELECT COUNT(*) as count FROM voters");
  const voterCount = (voterCountRes[0]?.values[0]?.[0] as number) || 0;

  if (voterCount === 0 || isLegacyDemo) {
    // Reset voters to the new requested CA, CC, and BUREAU members
    db.run("DELETE FROM voters");
    db.run("DELETE FROM voter_lists");
    db.run("DELETE FROM sessions");
    db.run("DELETE FROM session_voter_states");

    INITIAL_VOTERS.forEach((v) => {
      db.run(
        `INSERT INTO voters (id, name, title, specialty, department, email, weight, avatar_color, is_active, seat_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.name, v.title, v.specialty, v.department, v.email || '', v.weight, v.avatarColor, v.isActive ? 1 : 0, v.seatNumber]
      );
    });

    INITIAL_VOTER_LISTS.forEach(l => {
      db.run(
        `INSERT INTO voter_lists (id, name, code, description, voter_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [l.id, l.name, l.code, l.description || '', JSON.stringify(l.voterIds), l.createdAt]
      );
    });

    const now = new Date().toISOString();
    INITIAL_MEETINGS.forEach((m) => {
      db.run(
        `INSERT INTO sessions (
          id, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
          status, majority_required, quorum_pct, is_secret, outcome, created_at, closed_at,
          is_current_active, selected_attendee_ids, active_list_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.ref,
          m.title,
          m.motion,
          m.date,
          m.time,
          m.location,
          m.status,
          m.majority,
          m.quorum,
          m.isSecret ? 1 : 0,
          'pending',
          now,
          null,
          m.isActiveMeeting ? 1 : 0,
          JSON.stringify(m.attendeeIds),
          m.activeListCode
        ]
      );

      // Seed voter states for attendees
      m.attendeeIds.forEach(vid => {
        db.run(
          `INSERT INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
          [m.id, vid]
        );
      });
    });

    logEvent({
      id: `evt_${Date.now()}`,
      type: 'vote_started',
      title: 'Système de Vote Opérationnel',
      message: 'Listes officielles (CA, CC, Bureau) chargées avec succès.',
      timestamp: now,
      sessionId: 'session_ca_1'
    });
  } else {
    // Ensure voter_lists has default lists if not present
    const listCountRes = db.exec("SELECT COUNT(*) as count FROM voter_lists");
    const listCount = (listCountRes[0]?.values[0]?.[0] as number) || 0;
    if (listCount === 0) {
      INITIAL_VOTER_LISTS.forEach(l => {
        db.run(
          `INSERT INTO voter_lists (id, name, code, description, voter_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [l.id, l.name, l.code, l.description || '', JSON.stringify(l.voterIds), l.createdAt]
        );
      });
    }
  }

  saveDbToDisk();
  return db;
}

export function saveDbToDisk(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// Voter repository
export function getAllVoters(): Voter[] {
  const res = db.exec("SELECT * FROM voters ORDER BY seat_number ASC, name ASC");
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return {
      id: obj.id,
      name: obj.name,
      title: obj.title,
      specialty: obj.specialty || '',
      department: obj.department || '',
      email: obj.email || '',
      weight: obj.weight || 1,
      avatarColor: obj.avatar_color || '#0284c7',
      isActive: Boolean(obj.is_active),
      seatNumber: obj.seat_number || 0,
    };
  });
}

export function saveVoter(voterData: Partial<Voter> & { name: string }): Voter {
  const id = voterData.id || `voter_${Date.now()}`;
  const existing = db.exec("SELECT id FROM voters WHERE id = ?", [id]);
  
  if (existing.length && existing[0].values.length) {
    db.run(
      `UPDATE voters SET name=?, title=?, specialty=?, department=?, email=?, weight=?, avatar_color=?, is_active=?, seat_number=? WHERE id=?`,
      [
        voterData.name,
        voterData.title || 'M.',
        voterData.specialty || '',
        voterData.department || '',
        voterData.email || '',
        voterData.weight ?? 1,
        voterData.avatarColor || '#0284c7',
        voterData.isActive !== false ? 1 : 0,
        voterData.seatNumber || 0,
        id
      ]
    );
  } else {
    db.run(
      `INSERT INTO voters (id, name, title, specialty, department, email, weight, avatar_color, is_active, seat_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        voterData.name,
        voterData.title || 'M.',
        voterData.specialty || '',
        voterData.department || '',
        voterData.email || '',
        voterData.weight ?? 1,
        voterData.avatarColor || '#0284c7',
        voterData.isActive !== false ? 1 : 0,
        voterData.seatNumber || 0
      ]
    );

    // Auto-bind to current active session
    const active = getActiveSession();
    if (active) {
      db.run(
        `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
        [active.id, id]
      );
    }
  }

  saveDbToDisk();
  const all = getAllVoters();
  return all.find(v => v.id === id)!;
}

export function deleteVoter(id: string): boolean {
  db.run("DELETE FROM voters WHERE id = ?", [id]);
  db.run("DELETE FROM session_voter_states WHERE voter_id = ?", [id]);
  
  // Remove from all voter lists
  const lists = getAllVoterLists();
  lists.forEach(l => {
    if (l.voterIds.includes(id)) {
      const updated = l.voterIds.filter(vid => vid !== id);
      db.run("UPDATE voter_lists SET voter_ids = ? WHERE id = ?", [JSON.stringify(updated), l.id]);
    }
  });

  saveDbToDisk();
  return true;
}

// Voter Lists Management
export function getAllVoterLists(): VoterList[] {
  const res = db.exec("SELECT * FROM voter_lists ORDER BY code ASC, name ASC");
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    let voterIds: string[] = [];
    try {
      voterIds = JSON.parse(obj.voter_ids || '[]');
    } catch (_) {
      voterIds = [];
    }
    return {
      id: obj.id,
      name: obj.name,
      code: obj.code,
      description: obj.description || '',
      voterIds,
      createdAt: obj.created_at
    };
  });
}

export function saveVoterList(listData: Partial<VoterList> & { name: string; voterIds: string[] }): VoterList {
  const id = listData.id || `list_${Date.now()}`;
  const code = listData.code || listData.name.substring(0, 6).toUpperCase();
  const now = new Date().toISOString();
  const existing = db.exec("SELECT id FROM voter_lists WHERE id = ?", [id]);

  if (existing.length && existing[0].values.length) {
    db.run(
      `UPDATE voter_lists SET name=?, code=?, description=?, voter_ids=? WHERE id=?`,
      [
        listData.name,
        code,
        listData.description || '',
        JSON.stringify(listData.voterIds),
        id
      ]
    );
  } else {
    db.run(
      `INSERT INTO voter_lists (id, name, code, description, voter_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        listData.name,
        code,
        listData.description || '',
        JSON.stringify(listData.voterIds),
        now
      ]
    );
  }

  saveDbToDisk();
  const all = getAllVoterLists();
  return all.find(l => l.id === id)!;
}

export function deleteVoterList(id: string): boolean {
  db.run("DELETE FROM voter_lists WHERE id = ?", [id]);
  saveDbToDisk();
  return true;
}

export function applyVoterListToSession(sessionId: string, listIdOrCode: string): VotingSession | null {
  const lists = getAllVoterLists();
  const list = lists.find(l => l.id === listIdOrCode || l.code.toUpperCase() === listIdOrCode.toUpperCase());
  if (!list) return null;

  db.run(
    "UPDATE sessions SET selected_attendee_ids = ?, active_list_code = ? WHERE id = ?",
    [JSON.stringify(list.voterIds), list.code, sessionId]
  );

  // Clear existing votes for absent members and ensure present states for list members
  list.voterIds.forEach(vid => {
    db.run(
      `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
      [sessionId, vid]
    );
  });

  saveDbToDisk();
  return getActiveSession();
}

// Bulk Import parsed from string
export function importVotersFromText(rawText: string, listCode?: string): { count: number; voters: Voter[]; list?: VoterList } {
  // Parsing lines or entries like: "Benoit Pie SCHLOSSER" <benoitpie_SCHLOSSER@goodyear.com>; "billcagnot" <billcagnot@gmail.com>
  const emailRegex = /"?([^"<]+)"?\s*<([^>]+)>/g;
  const entries: Array<{ name: string; email: string }> = [];
  let match;

  while ((match = emailRegex.exec(rawText)) !== null) {
    const rawName = match[1].trim();
    const email = match[2].trim();
    if (rawName && email) {
      entries.push({ name: rawName, email });
    }
  }

  // If standard regex didn't find enough, try comma/semicolon/newline splitting
  if (entries.length === 0) {
    const lines = rawText.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    lines.forEach(l => {
      const parts = l.split(/[,<]/);
      const name = parts[0].replace(/["']/g, '').trim();
      const email = parts.length > 1 ? parts[1].replace(/[>]/g, '').trim() : '';
      if (name) {
        entries.push({ name, email });
      }
    });
  }

  const existingVoters = getAllVoters();
  const createdOrUpdatedIds: string[] = [];

  entries.forEach((entry, idx) => {
    let existing = existingVoters.find(v => (v.email && v.email.toLowerCase() === entry.email.toLowerCase()) || v.name.toLowerCase() === entry.name.toLowerCase());
    if (existing) {
      createdOrUpdatedIds.push(existing.id);
    } else {
      const id = `voter_${Date.now()}_${idx}`;
      const title = entry.name.toLowerCase().startsWith('mme') ? 'Mme' : 'M.';
      const cleanName = entry.name.replace(/^(M\.|Mme|Dr\.|Pr\.)\s*/i, '').trim();
      const newVoter = saveVoter({
        id,
        name: cleanName,
        title,
        email: entry.email,
        specialty: listCode ? `Membre ${listCode}` : 'Membre',
        department: listCode || 'Général',
        weight: 1,
        avatarColor: '#0284c7',
        isActive: true,
        seatNumber: existingVoters.length + idx + 1
      });
      createdOrUpdatedIds.push(newVoter.id);
    }
  });

  let savedList: VoterList | undefined;
  if (listCode && createdOrUpdatedIds.length > 0) {
    savedList = saveVoterList({
      name: `Liste ${listCode}`,
      code: listCode.toUpperCase(),
      description: `Import de ${createdOrUpdatedIds.length} membres`,
      voterIds: createdOrUpdatedIds
    });
  }

  saveDbToDisk();
  return {
    count: createdOrUpdatedIds.length,
    voters: getAllVoters(),
    list: savedList
  };
}

// Meetings management
export function sanitizeActiveSessions() {
  // Never let closed sessions be active
  db.run("UPDATE sessions SET is_current_active = 0 WHERE status = 'closed'");
  
  // Check how many open sessions are flagged as active
  const activeRes = db.exec("SELECT id FROM sessions WHERE is_current_active = 1 AND status != 'closed' ORDER BY created_at DESC");
  if (activeRes.length && activeRes[0].values.length) {
    // Keep only the first one
    const keepId = activeRes[0].values[0][0];
    db.run("UPDATE sessions SET is_current_active = 0 WHERE id != ?", [keepId]);
  } else {
    // If none are active, pick the newest open session if one exists
    const openRes = db.exec("SELECT id FROM sessions WHERE status != 'closed' ORDER BY created_at DESC LIMIT 1");
    if (openRes.length && openRes[0].values.length) {
      const openId = openRes[0].values[0][0];
      db.run("UPDATE sessions SET is_current_active = 1 WHERE id = ?", [openId]);
    }
  }
}

export function getAllMeetings(): MeetingItem[] {
  sanitizeActiveSessions();
  const res = db.exec("SELECT * FROM sessions ORDER BY is_current_active DESC, created_at DESC");
  if (!res.length) return [];
  const cols = res[0].columns;

  return res[0].values.map(row => {
    const s: any = {};
    cols.forEach((col, i) => { s[col] = row[i]; });

    let attendeesCount = 0;
    let votesCastCount = 0;

    const vsRes = db.exec(
      "SELECT COUNT(*) as total, SUM(CASE WHEN vote_choice IN ('for', 'against', 'abstain') THEN 1 ELSE 0 END) as voted FROM session_voter_states WHERE session_id = ?", 
      [s.id]
    );
    if (vsRes.length && vsRes[0].values.length) {
      attendeesCount = Number(vsRes[0].values[0][0]) || 0;
      votesCastCount = Number(vsRes[0].values[0][1]) || 0;
    }

    return {
      id: s.id,
      referenceCode: s.reference_code,
      title: s.title,
      motionText: s.motion_text,
      scheduledDate: s.scheduled_date,
      scheduledTime: s.scheduled_time,
      location: s.location || '',
      status: s.status,
      majorityRequired: s.majority_required,
      quorumPct: s.quorum_pct ?? 0,
      isSecret: Boolean(s.is_secret),
      outcome: s.outcome,
      createdAt: s.created_at,
      closedAt: s.closed_at,
      attendeesCount,
      votesCastCount,
      isActiveMeeting: Boolean(s.is_current_active) && s.status !== 'closed',
      activeListCode: s.active_list_code || undefined,
    };
  });
}

export function getActiveSession(): VotingSession | null {
  let res = db.exec("SELECT * FROM sessions WHERE is_current_active = 1 AND status != 'closed' LIMIT 1");
  if (!res.length || !res[0].values.length) {
    res = db.exec("SELECT * FROM sessions WHERE status != 'closed' ORDER BY created_at DESC LIMIT 1");
    if (res.length && res[0].values.length) {
      const activeId = res[0].values[0][0];
      db.run("UPDATE sessions SET is_current_active = 0");
      db.run("UPDATE sessions SET is_current_active = 1 WHERE id = ?", [activeId]);
    }
  }
  if (!res.length || !res[0].values.length) {
    res = db.exec("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1");
  }
  if (!res.length || !res[0].values.length) return null;

  const row = res[0].values[0];
  const cols = res[0].columns;
  const s: any = {};
  cols.forEach((col, i) => { s[col] = row[i]; });

  const vsRes = db.exec("SELECT * FROM session_voter_states WHERE session_id = ?", [s.id]);
  const voterStates: Record<string, VoterSessionState> = {};
  if (vsRes.length && vsRes[0].values.length) {
    const vsCols = vsRes[0].columns;
    vsRes[0].values.forEach(vsRow => {
      const vObj: any = {};
      vsCols.forEach((col, i) => { vObj[col] = vsRow[i]; });
      voterStates[vObj.voter_id] = {
        voterId: vObj.voter_id,
        presence: vObj.presence,
        proxyToId: vObj.proxy_to_id,
        vote: vObj.vote_choice,
        votedAt: vObj.voted_at,
        note: vObj.note,
      };
    });
  }

  let selectedAttendeeIds: string[] = [];
  if (s.selected_attendee_ids) {
    try {
      selectedAttendeeIds = JSON.parse(s.selected_attendee_ids);
    } catch (_) {
      selectedAttendeeIds = [];
    }
  }

  return {
    id: s.id,
    referenceCode: s.reference_code,
    title: s.title,
    motionText: s.motion_text,
    scheduledDate: s.scheduled_date,
    scheduledTime: s.scheduled_time,
    location: s.location || '',
    status: s.status,
    majorityRequired: s.majority_required,
    quorumPct: s.quorum_pct ?? 0,
    isSecret: Boolean(s.is_secret),
    outcome: s.outcome,
    createdAt: s.created_at,
    closedAt: s.closed_at,
    voterStates,
    selectedAttendeeIds,
    activeListCode: s.active_list_code || undefined,
  };
}

export function switchActiveMeeting(meetingId: string): VotingSession | null {
  const checkRes = db.exec("SELECT status FROM sessions WHERE id = ?", [meetingId]);
  if (checkRes.length && checkRes[0].values.length && checkRes[0].values[0][0] === 'closed') {
    throw new Error('Une séance scellée et clôturée ne peut pas être réactivée.');
  }

  db.run("UPDATE sessions SET is_current_active = 0");
  db.run("UPDATE sessions SET is_current_active = 1 WHERE id = ?", [meetingId]);
  
  const meeting = getActiveSession();
  if (meeting) {
    const voters = getAllVoters();
    const attendeeIds = meeting.selectedAttendeeIds && meeting.selectedAttendeeIds.length > 0
      ? meeting.selectedAttendeeIds
      : voters.filter(v => v.isActive).map(v => v.id);

    attendeeIds.forEach(vid => {
      db.run(
        `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
        [meeting.id, vid]
      );
    });
  }

  saveDbToDisk();
  return getActiveSession();
}

export function createOrUpdateSession(sessionData: Partial<VotingSession> & { attendeeIds?: string[] }): VotingSession {
  const id = sessionData.id || `session_${Date.now()}`;
  const now = new Date().toISOString();
  const existing = db.exec("SELECT id FROM sessions WHERE id = ?", [id]);

  const attendeeIdsJson = sessionData.attendeeIds 
    ? JSON.stringify(sessionData.attendeeIds) 
    : sessionData.selectedAttendeeIds 
      ? JSON.stringify(sessionData.selectedAttendeeIds) 
      : null;

  if (existing.length && existing[0].values.length) {
    db.run(
      `UPDATE sessions SET reference_code=?, title=?, motion_text=?, scheduled_date=?, scheduled_time=?, location=?, status=?, majority_required=?, quorum_pct=?, is_secret=?, outcome=?, closed_at=?, selected_attendee_ids=COALESCE(?, selected_attendee_ids), active_list_code=COALESCE(?, active_list_code) WHERE id=?`,
      [
        sessionData.referenceCode || 'CA-2026-08',
        sessionData.title || 'Ordre du jour',
        sessionData.motionText || '',
        sessionData.scheduledDate || now.split('T')[0],
        sessionData.scheduledTime || '14:30',
        sessionData.location || 'Salle du Conseil',
        sessionData.status || 'open',
        sessionData.majorityRequired || 'simple',
        sessionData.quorumPct ?? 0,
        sessionData.isSecret ? 1 : 0,
        sessionData.outcome || 'pending',
        sessionData.closedAt || null,
        attendeeIdsJson,
        sessionData.activeListCode || null,
        id
      ]
    );
  } else {
    db.run("UPDATE sessions SET is_current_active = 0");
    db.run(
      `INSERT INTO sessions (
        id, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
        status, majority_required, quorum_pct, is_secret, outcome, created_at, closed_at,
        is_current_active, selected_attendee_ids, active_list_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        sessionData.referenceCode || 'CA-2026-08',
        sessionData.title || 'Nouvelle Délibération',
        sessionData.motionText || '',
        sessionData.scheduledDate || now.split('T')[0],
        sessionData.scheduledTime || '14:30',
        sessionData.location || 'Salle du Conseil',
        sessionData.status || 'open',
        sessionData.majorityRequired || 'simple',
        sessionData.quorumPct ?? 0,
        sessionData.isSecret ? 1 : 0,
        sessionData.outcome || 'pending',
        now,
        null,
        attendeeIdsJson,
        sessionData.activeListCode || null
      ]
    );
  }

  // Ensure voter states exist for all selected attendees
  const voters = getAllVoters();
  const attendeeIds = sessionData.attendeeIds || sessionData.selectedAttendeeIds || voters.map(v => v.id);
  attendeeIds.forEach(vid => {
    db.run(
      `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
      [id, vid]
    );
  });

  saveDbToDisk();
  return getActiveSession()!;
}

export function deleteMeeting(id: string): boolean {
  db.run("DELETE FROM sessions WHERE id = ?", [id]);
  db.run("DELETE FROM session_voter_states WHERE session_id = ?", [id]);
  
  const remaining = getAllMeetings();
  if (remaining.length > 0) {
    const hasActive = remaining.some(m => m.isActiveMeeting);
    if (!hasActive) {
      switchActiveMeeting(remaining[0].id);
    }
  }

  saveDbToDisk();
  return true;
}

export function duplicateMeeting(id: string): VotingSession {
  const meetings = getAllMeetings();
  const src = meetings.find(m => m.id === id);
  if (!src) throw new Error('Réunion introuvable');

  const newId = `session_${Date.now()}`;
  return createOrUpdateSession({
    id: newId,
    referenceCode: `${src.referenceCode}-COPIE`,
    title: `${src.title} (Copie)`,
    motionText: src.motionText,
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: src.scheduledTime,
    location: src.location,
    status: 'draft',
    majorityRequired: src.majorityRequired,
    quorumPct: src.quorumPct ?? 0,
    isSecret: src.isSecret,
    activeListCode: src.activeListCode
  });
}

// Live Session state modifiers
export function updateVoterVote(sessionId: string, voterId: string, vote: string): VotingSession | null {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO session_voter_states (session_id, voter_id, presence, vote_choice, voted_at)
     VALUES (?, ?, 'present', ?, ?)
     ON CONFLICT(session_id, voter_id) DO UPDATE SET vote_choice=?, voted_at=?`,
    [sessionId, voterId, vote, now, vote, now]
  );

  // If this voter holds proxies from other members, propagate the vote to their proxies
  db.run(
    `UPDATE session_voter_states SET vote_choice=?, voted_at=? WHERE session_id=? AND proxy_to_id=? AND presence='proxy'`,
    [vote, now, sessionId, voterId]
  );

  saveDbToDisk();
  return getActiveSession();
}

export function updateVoterPresence(sessionId: string, voterId: string, presence: string, proxyToId?: string | null): VotingSession | null {
  const actualProxyToId = presence === 'proxy' && proxyToId ? proxyToId : null;

  // Strict validation: A mandataire cannot hold more than 2 proxies in the same session
  if (presence === 'proxy' && actualProxyToId) {
    if (actualProxyToId === voterId) {
      throw new Error('Un membre ne peut pas se donner procuration à lui-même.');
    }

    const checkRes = db.exec(
      `SELECT COUNT(*) FROM session_voter_states WHERE session_id = ? AND proxy_to_id = ? AND voter_id != ? AND presence = 'proxy'`,
      [sessionId, actualProxyToId, voterId]
    );
    const existingCount = Number(checkRes[0]?.values[0]?.[0]) || 0;
    if (existingCount >= 2) {
      throw new Error('Ce mandataire détient déjà le nombre maximal de 2 procurations autorisées.');
    }
  }

  db.run(
    `INSERT INTO session_voter_states (session_id, voter_id, presence, proxy_to_id, vote_choice)
     VALUES (?, ?, ?, ?, 'pending')
     ON CONFLICT(session_id, voter_id) DO UPDATE SET presence=?, proxy_to_id=?`,
    [sessionId, voterId, presence, actualProxyToId, presence, actualProxyToId]
  );
  saveDbToDisk();
  return getActiveSession();
}

export function resetSessionVotes(sessionId: string): void {
  db.run(
    `UPDATE session_voter_states SET vote_choice='pending', voted_at=NULL WHERE session_id=?`,
    [sessionId]
  );
  db.run(
    `UPDATE sessions SET status='open', outcome='pending', closed_at=NULL WHERE id=?`,
    [sessionId]
  );
  saveDbToDisk();
}

export function archiveAndCloseSession(sessionId: string, stats: any): SessionHistoryItem {
  const session = getActiveSession();
  if (!session) throw new Error('Session introuvable');

  const voters = getAllVoters();
  const voterStatesList: VoterSessionState[] = Object.values(session.voterStates);
  const now = new Date().toISOString();

  db.run(
    `UPDATE sessions SET status='closed', outcome=?, closed_at=?, is_current_active=0 WHERE id=?`,
    [stats.outcome, now, sessionId]
  );

  // If another non-closed session exists, designate it as the current active one
  const nextOpenRes = db.exec("SELECT id FROM sessions WHERE status != 'closed' ORDER BY created_at DESC LIMIT 1");
  if (nextOpenRes.length && nextOpenRes[0].values.length) {
    const nextId = nextOpenRes[0].values[0][0];
    db.run("UPDATE sessions SET is_current_active = 1 WHERE id = ?", [nextId]);
  }

  const historyId = `hist_${Date.now()}`;
  const detailedSnapshot = {
    session: { ...session, status: 'closed' as const, outcome: stats.outcome, closedAt: now },
    voters,
    voterStates: voterStatesList,
  };

  db.run(
    `INSERT INTO sessions_history (
      id, session_id, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
      total_eligible, total_present, quorum_reached, quorum_pct, votes_for, votes_against, votes_abstain,
      total_cast, majority_required, outcome, closed_at, detailed_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      historyId,
      session.id,
      session.referenceCode,
      session.title,
      session.motionText,
      session.scheduledDate,
      session.scheduledTime,
      session.location,
      stats.totalEligible,
      stats.presentCount + stats.proxyCount,
      stats.quorumReached ? 1 : 0,
      stats.quorumNeeded,
      stats.votesFor,
      stats.votesAgainst,
      stats.votesAbstain,
      stats.totalExpressed,
      session.majorityRequired,
      stats.outcome,
      now,
      JSON.stringify(detailedSnapshot)
    ]
  );

  saveDbToDisk();

  return {
    id: historyId,
    sessionId: session.id,
    referenceCode: session.referenceCode,
    title: session.title,
    motionText: session.motionText,
    scheduledDate: session.scheduledDate,
    scheduledTime: session.scheduledTime,
    location: session.location,
    totalEligible: stats.totalEligible,
    totalPresent: stats.presentCount + stats.proxyCount,
    quorumReached: stats.quorumReached,
    quorumPct: session.quorumPct ?? 0,
    votesFor: stats.votesFor,
    votesAgainst: stats.votesAgainst,
    votesAbstain: stats.votesAbstain,
    totalCast: stats.totalExpressed,
    majorityRequired: session.majorityRequired,
    outcome: stats.outcome,
    closedAt: now,
    detailedSnapshot: detailedSnapshot as any,
  };
}

export function getHistory(): SessionHistoryItem[] {
  const res = db.exec("SELECT * FROM sessions_history ORDER BY closed_at DESC");
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    let snapshot = {};
    try {
      snapshot = JSON.parse(obj.detailed_json);
    } catch (e) {
      snapshot = {};
    }
    return {
      id: obj.id,
      sessionId: obj.session_id,
      referenceCode: obj.reference_code,
      title: obj.title,
      motionText: obj.motion_text,
      scheduledDate: obj.scheduled_date,
      scheduledTime: obj.scheduled_time,
      location: obj.location,
      totalEligible: obj.total_eligible,
      totalPresent: obj.total_present,
      quorumReached: Boolean(obj.quorum_reached),
      quorumPct: obj.quorum_pct,
      votesFor: obj.votes_for,
      votesAgainst: obj.votes_against,
      votesAbstain: obj.votes_abstain,
      totalCast: obj.total_cast,
      majorityRequired: obj.majority_required,
      outcome: obj.outcome,
      closedAt: obj.closed_at,
      detailedSnapshot: snapshot as any,
    };
  });
}

export function deleteHistoryItem(id: string): boolean {
  db.run("DELETE FROM sessions_history WHERE id = ?", [id]);
  saveDbToDisk();
  return true;
}

// Event logging & Notifications
export function logEvent(event: Partial<RealtimeNotification>): RealtimeNotification {
  const id = event.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = event.timestamp || new Date().toISOString();

  db.run(
    `INSERT INTO events_log (id, type, title, message, timestamp, voter_name, vote_choice, session_id, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      event.type || 'info',
      event.title || 'Notification',
      event.message || '',
      now,
      event.voterName || null,
      event.voteChoice || null,
      event.sessionId || null,
      event.outcome || null
    ]
  );

  saveDbToDisk();

  return {
    id,
    type: event.type || 'info',
    title: event.title || 'Notification',
    message: event.message || '',
    timestamp: now,
    voterName: event.voterName,
    voteChoice: event.voteChoice,
    sessionId: event.sessionId,
    outcome: event.outcome,
    read: false
  };
}

export function getRecentEvents(limit: number = 50): RealtimeNotification[] {
  const res = db.exec(`SELECT * FROM events_log ORDER BY timestamp DESC LIMIT ${limit}`);
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return {
      id: obj.id,
      type: obj.type,
      title: obj.title,
      message: obj.message,
      timestamp: obj.timestamp,
      voterName: obj.voter_name || undefined,
      voteChoice: obj.vote_choice || undefined,
      sessionId: obj.session_id || undefined,
      outcome: obj.outcome || undefined,
      read: true
    };
  });
}

export function clearEvents(): boolean {
  db.run("DELETE FROM events_log");
  saveDbToDisk();
  return true;
}

// Motion Templates Management
export function getAllTemplates() {
  const res = db.exec("SELECT * FROM motion_templates ORDER BY created_at DESC");
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return {
      id: obj.id,
      name: obj.name,
      title: obj.title,
      motionText: obj.motion_text,
      majorityRequired: obj.majority_required,
      quorumPct: Number(obj.quorum_pct || 0),
      createdAt: obj.created_at
    };
  });
}

export function saveTemplate(tpl: { id?: string; name: string; title: string; motionText: string; majorityRequired?: string; quorumPct?: number }) {
  const id = tpl.id || `tpl_${Date.now()}`;
  const now = new Date().toISOString();
  const majority = tpl.majorityRequired || 'simple';
  const quorum = Number(tpl.quorumPct || 0);

  const exists = db.exec("SELECT id FROM motion_templates WHERE id = ?", [id]);
  if (exists.length && exists[0].values.length) {
    db.run(
      "UPDATE motion_templates SET name = ?, title = ?, motion_text = ?, majority_required = ?, quorum_pct = ? WHERE id = ?",
      [tpl.name, tpl.title, tpl.motionText, majority, quorum, id]
    );
  } else {
    db.run(
      "INSERT INTO motion_templates (id, name, title, motion_text, majority_required, quorum_pct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, tpl.name, tpl.title, tpl.motionText, majority, quorum, now]
    );
  }
  saveDbToDisk();
  return { id, name: tpl.name, title: tpl.title, motionText: tpl.motionText, majorityRequired: majority, quorumPct: quorum, createdAt: now };
}

export function deleteTemplate(id: string): boolean {
  db.run("DELETE FROM motion_templates WHERE id = ?", [id]);
  saveDbToDisk();
  return true;
}

export function resetToDemoData() {
  db.run("DROP TABLE IF EXISTS voters");
  db.run("DROP TABLE IF EXISTS voter_lists");
  db.run("DROP TABLE IF EXISTS sessions");
  db.run("DROP TABLE IF EXISTS session_voter_states");
  db.run("DROP TABLE IF EXISTS sessions_history");
  db.run("DROP TABLE IF EXISTS events_log");
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }
  db = null as any;
  return initDatabase();
}
