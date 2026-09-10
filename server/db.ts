import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { calculateVoteStatistics } from '../src/utils/votingMath';
import { 
  Voter, 
  Seance,
  VotingSession, 
  VoterSessionState, 
  SessionHistoryItem, 
  SessionOutcome,
  SessionStatus,
  MeetingItem,
  RealtimeNotification,
  VoterList,
  VoteStatistics
} from '../src/types';

const DATA_DIR = process.env.MEDIVOTE_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'medivote.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'sauvegardes');

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
  { id: 'voter_dichamps', name: 'Franck DICHAMPS', title: 'M.', specialty: 'Administrateur CA', department: 'Conseil d\'Administration', email: 'franckdichamps@gmail.com', weight: 1, avatarColor: '#4338ca', isActive: true, seatNumber: 12, listCodes: ['CA'] },
  { id: 'voter_fayet', name: 'Isabelle FAYET', title: 'Mme', specialty: 'Administratrice CA & Bureau', department: 'Auvergne Marée / SSTI', email: 'direction@auvergnemaree.com', weight: 1, avatarColor: '#db2777', isActive: true, seatNumber: 13, listCodes: ['CA', 'BUREAU'] },
  { id: 'voter_feydel', name: 'Isabelle FEYDEL', title: 'Mme', specialty: 'Administratrice CA & CC', department: 'Conseil d\'Administration', email: 'isabelle-feydel@orange.fr', weight: 1, avatarColor: '#9333ea', isActive: true, seatNumber: 14, listCodes: ['CA', 'CC'] },
  { id: 'voter_buvat', name: 'Jean-Marc BUVAT', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'Direction', email: 'jeanmarcbuvat@gmail.com', weight: 1, avatarColor: '#0d9488', isActive: true, seatNumber: 15, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_chassagne', name: 'Ka Youa CHASSAGNE', title: 'Mme', specialty: 'Administratrice CA', department: 'Safran Group', email: 'ka-youa.chassagne@safrangroup.com', weight: 1, avatarColor: '#ca8a04', isActive: true, seatNumber: 16, listCodes: ['CA'] },
  { id: 'voter_combemorel', name: 'Nicolas COMBEMOREL', title: 'M.', specialty: 'Administrateur CA, CC & Bureau', department: 'Les Mousquetaires', email: 'Nicolas.combemorel-adh@mousquetaires.com', weight: 1, avatarColor: '#2563eb', isActive: true, seatNumber: 17, listCodes: ['CA', 'CC', 'BUREAU'] },
  { id: 'voter_joannet', name: 'Olivier JOANNET', title: 'M.', specialty: 'Administrateur CA', department: 'Accore Groupe', email: 'ojoannet@accore-grp.com', weight: 1, avatarColor: '#475569', isActive: true, seatNumber: 18, listCodes: ['CA'] },
  { id: 'voter_cartelier', name: 'Sarah CARTELIER', title: 'Mme', specialty: 'Administratrice CA & CC', department: 'Chronos Jobs', email: 's.cartelier@chronos.jobs', weight: 1, avatarColor: '#e11d48', isActive: true, seatNumber: 19, listCodes: ['CA', 'CC'] },
  { id: 'voter_tonneaux', name: 'Sophie TONNEAUX', title: 'Mme', specialty: 'Administratrice CA & Bureau', department: 'SSTI 03', email: 'tonneaux.sophieide@gmail.com', weight: 1, avatarColor: '#10b981', isActive: true, seatNumber: 20, listCodes: ['CA', 'BUREAU'] },
  { id: 'voter_jouannet', name: 'Thierry JOUANNET', title: 'M.', specialty: 'Membre CA & CC', department: 'Conseil d\'Administration', email: 'thierry.tjo@outlook.fr', weight: 1, avatarColor: '#6366f1', isActive: true, seatNumber: 21, listCodes: ['CA', 'CC'] },
  { id: 'voter_leveau', name: 'Xavier LEVEAU', title: 'M.', specialty: 'Administrateur CA', department: 'Groupe Séché', email: 'x.leveau@groupe-seche.com', weight: 1, avatarColor: '#d97706', isActive: true, seatNumber: 22, listCodes: ['CA'] },
  // Specific CC Members
  { id: 'voter_avignon', name: 'Gilles AVIGNON', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Safran Group', email: 'gilles.avignon@safrangroup.com', weight: 1, avatarColor: '#0284c7', isActive: true, seatNumber: 23, listCodes: ['CC'] },
  { id: 'voter_mallot', name: 'Cyrielle MALLOT', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'cyriellemallot2010@gmail.com', weight: 1, avatarColor: '#7c3aed', isActive: true, seatNumber: 24, listCodes: ['CC'] },
  { id: 'voter_vuylsteke', name: 'David VUYLSTEKE', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'david03700@hotmail.fr', weight: 1, avatarColor: '#2563eb', isActive: true, seatNumber: 25, listCodes: ['CC'] },
  { id: 'voter_grissonnanche', name: 'Valérie GRISSONNANCHE', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'Commission de Contrôle', email: 'grissonnanche03@gmail.com', weight: 1, avatarColor: '#e11d48', isActive: true, seatNumber: 26, listCodes: ['CC'] },
  { id: 'voter_vincent', name: 'Laure VINCENT', title: 'Mme', specialty: 'Membre Commission de Contrôle', department: 'MEDEF Allier', email: 'laure.vincent@medef-allier.com', weight: 1, avatarColor: '#0d9488', isActive: true, seatNumber: 27, listCodes: ['CC'] },
  { id: 'voter_esbelin', name: 'Morgan ESBELIN', title: 'M.', specialty: 'Membre Commission de Contrôle', department: 'Adhap Services', email: 'm.esbelin@adhapservices.eu', weight: 1, avatarColor: '#ea580c', isActive: true, seatNumber: 28, listCodes: ['CC'] },
];

const INITIAL_VOTER_LISTS: VoterList[] = [
  {
    id: 'list_ca',
    name: 'Conseil d\'Administration (CA)',
    code: 'CA',
    description: 'Administrateurs siégeant au Conseil d\'Administration',
    voterIds: [
      'voter_schlosser', 'voter_cagnot', 'voter_lot', 'voter_clavon', 'voter_dupit',
      'voter_furberg', 'voter_deroover', 'voter_cury', 'voter_remeau', 'voter_cypres',
      'voter_masquelier', 'voter_dichamps', 'voter_fayet', 'voter_feydel', 'voter_buvat',
      'voter_chassagne', 'voter_combemorel', 'voter_joannet', 'voter_cartelier',
      'voter_tonneaux', 'voter_jouannet', 'voter_leveau'
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'list_cc',
    name: 'Commission de Contrôle (CC)',
    code: 'CC',
    description: 'Membres de la Commission de Contrôle',
    voterIds: [
      'voter_avignon', 'voter_cagnot', 'voter_furberg', 'voter_mallot', 'voter_vuylsteke',
      'voter_grissonnanche', 'voter_feydel', 'voter_buvat', 'voter_vincent',
      'voter_esbelin', 'voter_combemorel', 'voter_cartelier', 'voter_jouannet'
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'list_bureau',
    name: 'Bureau',
    code: 'BUREAU',
    description: 'Membres siégeant au Bureau exécutif',
    voterIds: [
      'voter_schlosser', 'voter_cagnot', 'voter_fayet', 'voter_buvat',
      'voter_combemorel', 'voter_tonneaux'
    ],
    createdAt: new Date().toISOString()
  }
];

const INITIAL_MEETINGS = [
  {
    id: 'session_ca_1',
    seanceId: 'seance_ca_1',
    seanceRef: 'CA-2026-08',
    seanceTitle: 'Conseil d\'Administration — séance ordinaire',
    ordre: 1,
    ref: 'CA-2026-08/R1',
    title: 'Délibération du Conseil d\'Administration - Plan d\'Orientation Stratégique',
    motion: 'Article 1.1 - Approbation du plan d\'orientation stratégique et des délibérations budgétaires présentées lors de la séance plénière du Conseil d\'Administration.',
    date: new Date().toISOString().split('T')[0],
    time: '14:30',
    location: 'Saint-Victor',
    status: 'draft' as const,
    majority: 'simple' as const,
    quorum: 0, // Default: no minimum quorum
    isSecret: false,
    isActiveMeeting: true,
    activeListCode: 'CA',
    attendeeIds: INITIAL_VOTER_LISTS[0].voterIds
  },
  {
    id: 'session_ca_2',
    seanceId: 'seance_ca_1',
    seanceRef: 'CA-2026-08',
    seanceTitle: 'Conseil d\'Administration — séance ordinaire',
    ordre: 2,
    ref: 'CA-2026-08/R2',
    title: 'Renouvellement du Bureau',
    motion: 'Article 1.2 - Renouvellement des membres du Bureau pour l\'exercice à venir, conformément aux statuts.',
    date: new Date().toISOString().split('T')[0],
    time: '14:30',
    location: 'Saint-Victor',
    status: 'draft' as const,
    majority: 'absolute' as const,
    quorum: 0,
    isSecret: false,
    isActiveMeeting: false,
    activeListCode: 'CA',
    attendeeIds: INITIAL_VOTER_LISTS[0].voterIds
  },
  {
    id: 'session_cc_1',
    seanceId: 'seance_cc_1',
    seanceRef: 'CC-2026-08',
    seanceTitle: 'Commission de Contrôle',
    ordre: 1,
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
    seanceId: 'seance_bur_1',
    seanceRef: 'BUR-2026-08',
    seanceTitle: 'Réunion du Bureau',
    ordre: 1,
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

    CREATE TABLE IF NOT EXISTS seances (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL,
      title TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      location TEXT,
      created_at TEXT NOT NULL,
      closed_at TEXT,
      is_current_active INTEGER DEFAULT 0,
      selected_attendee_ids TEXT,
      active_list_code TEXT,
      resolution_courante_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      seance_id TEXT,
      ordre INTEGER DEFAULT 1,
      reference_code TEXT NOT NULL,
      title TEXT NOT NULL,
      motion_text TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'draft',
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

    CREATE TABLE IF NOT EXISTS appareils_confiance (
      empreinte TEXT PRIMARY KEY,
      libelle TEXT,
      cree_le TEXT NOT NULL,
      expire_le TEXT NOT NULL,
      dernier_usage TEXT
    );

    CREATE TABLE IF NOT EXISTS jetons_vote (
      jeton TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      cree_le TEXT NOT NULL,
      expire_le TEXT NOT NULL,
      utilise_le TEXT
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
  // Une séance porte désormais plusieurs résolutions : chaque ligne de `sessions`
  // est une résolution, rattachée à sa séance et rangée dans l'ordre du jour.
  try { db.run(`ALTER TABLE sessions ADD COLUMN seance_id TEXT;`); } catch (_) {}
  try { db.run(`ALTER TABLE sessions ADD COLUMN ordre INTEGER DEFAULT 1;`); } catch (_) {}
  // Le lien de vote vaut pour toute la séance : un membre scanne une fois et
  // vote sur chaque résolution à mesure qu'elle s'ouvre.
  try { db.run(`ALTER TABLE jetons_vote ADD COLUMN seance_id TEXT;`); } catch (_) {}
  // Ensure closed sessions never remain marked as current active
  try { db.run(`UPDATE sessions SET is_current_active = 0 WHERE status = 'closed';`); } catch (_) {}

  /*
   * Remise en cohérence des émargements : ils ne concernent que les convoqués.
   * Retirer un membre de la convocation d'un vote laissait jusqu'ici sa ligne en
   * place, si bien que l'ordre du jour annonçait « 0/28 suffrages » quand la
   * table n'en comptait plus que 13. Les scrutins clôturés sont laissés
   * intacts : leur émargement est celui de la clôture, et il fait foi.
   */
  try {
    const aRecoller = db.exec(
      `SELECT id, selected_attendee_ids FROM sessions
       WHERE status != 'closed' AND selected_attendee_ids IS NOT NULL AND selected_attendee_ids != '[]'`
    );
    if (aRecoller.length) {
      aRecoller[0].values.forEach(([sessionId, brut]: any[]) => {
        let convoques: string[];
        try { convoques = JSON.parse(String(brut)); } catch (_) { return; }
        if (!Array.isArray(convoques) || convoques.length === 0) return;
        db.run(
          `DELETE FROM session_voter_states
           WHERE session_id = ? AND voter_id NOT IN (SELECT value FROM json_each(?))`,
          [sessionId, JSON.stringify(convoques)]
        );
      });
    }
  } catch (_) {}

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

    // Les séances d'abord : ce sont elles qui portent la date, le lieu et le
    // collège convoqué. Les résolutions viennent s'y ranger dans l'ordre.
    const seancesSemees = new Map<string, typeof INITIAL_MEETINGS[number]>();
    INITIAL_MEETINGS.forEach(m => {
      if (!seancesSemees.has(m.seanceId)) seancesSemees.set(m.seanceId, m);
    });
    seancesSemees.forEach((m, seanceId) => {
      const premiere = INITIAL_MEETINGS.filter(x => x.seanceId === seanceId).sort((a, b) => a.ordre - b.ordre)[0];
      db.run(
        `INSERT INTO seances (
          id, reference_code, title, scheduled_date, scheduled_time, location,
          created_at, closed_at, is_current_active, selected_attendee_ids,
          active_list_code, resolution_courante_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        [
          seanceId,
          m.seanceRef,
          m.seanceTitle,
          m.date,
          m.time,
          m.location,
          now,
          m.isActiveMeeting ? 1 : 0,
          JSON.stringify(m.attendeeIds),
          m.activeListCode,
          premiere.id,
        ]
      );
    });

    INITIAL_MEETINGS.forEach((m) => {
      db.run(
        `INSERT INTO sessions (
          id, seance_id, ordre, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
          status, majority_required, quorum_pct, is_secret, outcome, created_at, closed_at,
          is_current_active, selected_attendee_ids, active_list_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.seanceId,
          m.ordre,
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
          m.isActiveMeeting && m.ordre === 1 ? 1 : 0,
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

  migrerVersSeances();

  saveDbToDisk();
  return db;
}

/* ------------------------------------------------------------------
 * Séances et résolutions
 *
 * Une séance est la réunion : une date, un lieu, un collège convoqué, un
 * émargement. Elle porte une ou plusieurs résolutions — les lignes de la table
 * `sessions` — et c'est chaque résolution qui s'ouvre, se vote et se clôture.
 * On peut ajouter une résolution à tout moment, y compris pendant la séance.
 * ------------------------------------------------------------------ */

/** Racine d'une référence de résolution : « CA-2026-08/R2 » → « CA-2026-08 ». */
function racineReference(reference: string): string {
  return String(reference || '').split('/')[0].trim() || 'SEANCE';
}

/**
 * Rattache à une séance toute résolution qui n'en a pas encore.
 *
 * Les bases antérieures ne connaissaient qu'un niveau : une « séance » y valait
 * une résolution. On regroupe celles qui partagent la même racine de référence
 * et la même date — deux lignes « CA-2026-09/R1 » et « CA-2026-09/R2 » du même
 * jour étaient bien deux points de l'ordre du jour d'une seule réunion — et on
 * laisse les autres seules dans leur séance. Aucun suffrage n'est touché.
 */
export function migrerVersSeances(): void {
  const orphelines = db.exec(
    "SELECT * FROM sessions WHERE seance_id IS NULL OR seance_id = '' ORDER BY created_at ASC"
  );
  if (!orphelines.length || !orphelines[0].values.length) return;

  const cols = orphelines[0].columns;
  const lignes = orphelines[0].values.map(row => {
    const o: any = {};
    cols.forEach((c, i) => { o[c] = row[i]; });
    return o;
  });

  const groupes = new Map<string, any[]>();
  lignes.forEach(l => {
    const cle = `${racineReference(l.reference_code)}::${l.scheduled_date}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(l);
  });

  groupes.forEach((membres) => {
    const premiere = membres[0];
    const seanceId = `seance_${premiere.id}`;
    const courante =
      membres.find(m => Number(m.is_current_active) === 1) ||
      membres.find(m => m.status !== 'closed') ||
      membres[membres.length - 1];
    const toutesCloses = membres.every(m => m.status === 'closed');
    const closedAt = toutesCloses
      ? membres.map(m => m.closed_at).filter(Boolean).sort().pop() || null
      : null;

    db.run(
      `INSERT INTO seances (
        id, reference_code, title, scheduled_date, scheduled_time, location,
        created_at, closed_at, is_current_active, selected_attendee_ids,
        active_list_code, resolution_courante_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seanceId,
        racineReference(premiere.reference_code),
        membres.length === 1 ? premiere.title : `Séance du ${premiere.scheduled_date}`,
        premiere.scheduled_date,
        premiere.scheduled_time,
        premiere.location || '',
        premiere.created_at,
        closedAt,
        membres.some(m => Number(m.is_current_active) === 1) ? 1 : 0,
        courante.selected_attendee_ids || premiere.selected_attendee_ids || null,
        courante.active_list_code || premiere.active_list_code || null,
        courante.id,
      ]
    );

    membres.forEach((m, i) => {
      db.run("UPDATE sessions SET seance_id=?, ordre=? WHERE id=?", [seanceId, i + 1, m.id]);
      db.run("UPDATE jetons_vote SET seance_id=? WHERE session_id=?", [seanceId, m.id]);
    });
  });
}

/**
 * Écriture atomique : la base est d'abord écrite dans un fichier temporaire, vidée sur
 * le disque, puis renommée. Une coupure en cours d'écriture laisse donc intacte la
 * dernière version valide, au lieu d'un fichier tronqué — une séance ne se perd pas.
 */
export function saveDbToDisk(): void {
  if (!db) return;
  const buffer = Buffer.from(db.export());
  const tmpFile = `${DB_FILE}.tmp`;
  const fd = fs.openSync(tmpFile, 'w');
  try {
    fs.writeFileSync(fd, buffer);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpFile, DB_FILE);
}

/** Copie horodatée de la base, prise à chaque clôture de scrutin. */
export function sauvegarderBase(motif: string): string | null {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
    const cible = path.join(BACKUP_DIR, `medivote_${horodatage}_${motif}.sqlite`);
    fs.copyFileSync(DB_FILE, cible);
    return cible;
  } catch (err) {
    console.error('Sauvegarde impossible :', err);
    return null;
  }
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

/**
 * Retire un membre du répertoire et de tout ce qui est encore vivant : collèges,
 * convocations des séances et de leurs résolutions, émargements, bulletins non
 * clos, liens de vote. Les procès-verbaux déjà archivés ne bougent pas : ils
 * portent leur propre copie des votants et des suffrages, et font foi.
 */
export function deleteVoter(id: string): boolean {
  db.run("DELETE FROM voters WHERE id = ?", [id]);
  db.run("DELETE FROM session_voter_states WHERE voter_id = ?", [id]);

  // Un mandant qui avait donné pouvoir au partant redevient simplement absent.
  db.run(
    "UPDATE session_voter_states SET presence = 'absent', proxy_to_id = NULL WHERE proxy_to_id = ?",
    [id]
  );

  // Ses liens de vote nominatifs n'ont plus d'objet.
  db.run("DELETE FROM jetons_vote WHERE voter_id = ?", [id]);

  // Retrait des collèges electoraux.
  const lists = getAllVoterLists();
  lists.forEach(l => {
    if (l.voterIds.includes(id)) {
      const updated = l.voterIds.filter(vid => vid !== id);
      db.run("UPDATE voter_lists SET voter_ids = ? WHERE id = ?", [JSON.stringify(updated), l.id]);
    }
  });

  // Retrait des convocations, séance par séance et résolution par résolution.
  retirerDesConvocations('seances', id);
  retirerDesConvocations('sessions', id);

  saveDbToDisk();
  return true;
}

/** Enlève un identifiant de votant des listes `selected_attendee_ids` d'une table. */
function retirerDesConvocations(table: 'seances' | 'sessions', voterId: string): void {
  const res = db.exec(`SELECT id, selected_attendee_ids FROM ${table}`);
  if (!res.length) return;
  res[0].values.forEach(([rowId, brut]: any[]) => {
    if (!brut) return;
    let ids: string[];
    try {
      ids = JSON.parse(brut);
    } catch (_) {
      return;
    }
    if (!Array.isArray(ids) || !ids.includes(voterId)) return;
    db.run(
      `UPDATE ${table} SET selected_attendee_ids = ? WHERE id = ?`,
      [JSON.stringify(ids.filter(v => v !== voterId)), rowId]
    );
  });
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

  /*
   * Le collège convoqué appartient à la séance, pas à un point de son ordre du
   * jour : appliquer une liste vaut donc pour la séance entière et pour toutes
   * ses résolutions encore ouvrables. Celles déjà clôturées gardent le collège
   * inscrit à leur procès-verbal.
   */
  const seanceId = seanceDeResolution(sessionId);
  const cibles: string[] = [sessionId];
  if (seanceId) {
    db.run(
      "UPDATE seances SET selected_attendee_ids = ?, active_list_code = ? WHERE id = ?",
      [JSON.stringify(list.voterIds), list.code, seanceId]
    );
    const fratrie = db.exec(
      "SELECT id FROM sessions WHERE seance_id = ? AND status != 'closed' AND id != ?",
      [seanceId, sessionId]
    );
    if (fratrie.length && fratrie[0].values.length) {
      fratrie[0].values.forEach(row => cibles.push(String(row[0])));
    }
  }

  cibles.forEach(cible => {
    db.run(
      "UPDATE sessions SET selected_attendee_ids = ?, active_list_code = ? WHERE id = ?",
      [JSON.stringify(list.voterIds), list.code, cible]
    );
    list.voterIds.forEach(vid => {
      db.run(
        `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
        [cible, vid]
      );
    });
  });

  saveDbToDisk();
  return getSessionById(sessionId);
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
/**
 * Remet de l'ordre dans les désignations : une seule séance affichée sur la
 * table, et une résolution courante qui appartient bien à cette séance.
 * Une séance clôturée n'est jamais celle affichée.
 */
export function sanitizeActiveSessions() {
  db.run("UPDATE seances SET is_current_active = 0 WHERE closed_at IS NOT NULL");

  const actives = db.exec(
    "SELECT id FROM seances WHERE is_current_active = 1 AND closed_at IS NULL ORDER BY created_at DESC"
  );
  let seanceId: string | null = null;

  if (actives.length && actives[0].values.length) {
    seanceId = String(actives[0].values[0][0]);
    db.run("UPDATE seances SET is_current_active = 0 WHERE id != ?", [seanceId]);
  } else {
    const ouvertes = db.exec(
      "SELECT id FROM seances WHERE closed_at IS NULL ORDER BY created_at DESC LIMIT 1"
    );
    if (ouvertes.length && ouvertes[0].values.length) {
      seanceId = String(ouvertes[0].values[0][0]);
      db.run("UPDATE seances SET is_current_active = 0");
      db.run("UPDATE seances SET is_current_active = 1 WHERE id = ?", [seanceId]);
    }
  }

  // Plus aucune séance ouvrable : la table est vide, et on le dit. Désigner
  // ici la dernière séance créée — close — faisait croire qu'une séance close
  // était encore affichée, alors que la clôture l'a précisément retirée.
  if (!seanceId) {
    db.run("UPDATE sessions SET is_current_active = 0");
    return;
  }

  // La résolution courante doit exister et appartenir à la séance.
  const courante = db.exec(
    `SELECT s.id FROM seances se
     JOIN sessions s ON s.id = se.resolution_courante_id AND s.seance_id = se.id
     WHERE se.id = ?`,
    [seanceId]
  );
  if (!courante.length || !courante[0].values.length) {
    const remplacante = db.exec(
      `SELECT id FROM sessions WHERE seance_id = ?
       ORDER BY CASE WHEN status = 'closed' THEN 1 ELSE 0 END, ordre ASC LIMIT 1`,
      [seanceId]
    );
    if (remplacante.length && remplacante[0].values.length) {
      db.run("UPDATE seances SET resolution_courante_id = ? WHERE id = ?", [
        remplacante[0].values[0][0],
        seanceId,
      ]);
    }
  }

  // `sessions.is_current_active` reste tenu à jour : il désigne la résolution
  // présentée sur la table, et sert de repère aux écrans de pilotage.
  db.run("UPDATE sessions SET is_current_active = 0");
  db.run(
    `UPDATE sessions SET is_current_active = 1
     WHERE id = (SELECT resolution_courante_id FROM seances WHERE id = ?)`,
    [seanceId]
  );
}

/** Identifiant de la séance sur la table. `null` si aucune n'y est. */
export function seanceActiveId(): string | null {
  sanitizeActiveSessions();
  const res = db.exec("SELECT id FROM seances WHERE is_current_active = 1 LIMIT 1");
  return res.length && res[0].values.length ? String(res[0].values[0][0]) : null;
}

/** Séance à laquelle appartient une résolution. */
export function seanceDeResolution(resolutionId: string): string | null {
  const res = db.exec("SELECT seance_id FROM sessions WHERE id = ?", [resolutionId]);
  if (!res.length || !res[0].values.length) return null;
  const valeur = res[0].values[0][0];
  return valeur ? String(valeur) : null;
}

/** Les résolutions d'une séance, dans l'ordre de l'ordre du jour. */
export function resolutionsDeSeance(seanceId: string): MeetingItem[] {
  return meetingsDepuis("SELECT * FROM sessions WHERE seance_id = ? ORDER BY ordre ASC, created_at ASC", [seanceId]);
}

function hydrateSeance(cols: string[], row: any[]): Seance {
  const o: any = {};
  cols.forEach((c, i) => { o[c] = row[i]; });

  let convoques: string[] = [];
  if (o.selected_attendee_ids) {
    try { convoques = JSON.parse(o.selected_attendee_ids); } catch (_) { convoques = []; }
  }

  return {
    id: String(o.id),
    referenceCode: o.reference_code,
    title: o.title,
    scheduledDate: o.scheduled_date,
    scheduledTime: o.scheduled_time,
    location: o.location || '',
    createdAt: o.created_at,
    closedAt: o.closed_at || null,
    surLaTable: Boolean(o.is_current_active),
    selectedAttendeeIds: convoques,
    activeListCode: o.active_list_code || undefined,
    resolutionCouranteId: o.resolution_courante_id || null,
    resolutions: resolutionsDeSeance(String(o.id)),
  };
}

export function getSeanceById(seanceId: string): Seance | null {
  const res = db.exec("SELECT * FROM seances WHERE id = ? LIMIT 1", [seanceId]);
  if (!res.length || !res[0].values.length) return null;
  return hydrateSeance(res[0].columns, res[0].values[0]);
}

export function getAllSeances(): Seance[] {
  sanitizeActiveSessions();
  const res = db.exec(
    "SELECT * FROM seances ORDER BY is_current_active DESC, scheduled_date DESC, created_at DESC"
  );
  if (!res.length) return [];
  return res[0].values.map(row => hydrateSeance(res[0].columns, row));
}

export function getSeanceActive(): Seance | null {
  const id = seanceActiveId();
  return id ? getSeanceById(id) : null;
}

/** Crée une séance, ou met à jour ses coordonnées. Elle ne porte aucun suffrage. */
export function creerOuMajSeance(donnees: Partial<Seance> & { attendeeIds?: string[] }): Seance {
  const id = donnees.id || `seance_${Date.now()}`;
  const maintenant = new Date().toISOString();
  const existante = db.exec("SELECT id FROM seances WHERE id = ?", [id]);
  const convoquesJson = donnees.attendeeIds
    ? JSON.stringify(donnees.attendeeIds)
    : donnees.selectedAttendeeIds
      ? JSON.stringify(donnees.selectedAttendeeIds)
      : null;

  if (existante.length && existante[0].values.length) {
    db.run(
      `UPDATE seances SET reference_code=?, title=?, scheduled_date=?, scheduled_time=?, location=?,
       selected_attendee_ids=COALESCE(?, selected_attendee_ids),
       active_list_code=COALESCE(?, active_list_code) WHERE id=?`,
      [
        donnees.referenceCode || 'SEANCE',
        donnees.title || 'Séance',
        donnees.scheduledDate || maintenant.split('T')[0],
        donnees.scheduledTime || '14:30',
        donnees.location || '',
        convoquesJson,
        donnees.activeListCode || null,
        id,
      ]
    );
  } else {
    db.run("UPDATE seances SET is_current_active = 0");
    db.run(
      `INSERT INTO seances (
        id, reference_code, title, scheduled_date, scheduled_time, location,
        created_at, closed_at, is_current_active, selected_attendee_ids,
        active_list_code, resolution_courante_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, NULL)`,
      [
        id,
        donnees.referenceCode || 'SEANCE',
        donnees.title || 'Séance',
        donnees.scheduledDate || maintenant.split('T')[0],
        donnees.scheduledTime || '14:30',
        donnees.location || '',
        maintenant,
        convoquesJson,
        donnees.activeListCode || null,
      ]
    );
  }

  // Les coordonnées de la séance font foi : les résolutions encore ouvrables
  // les recopient, pour que le procès-verbal porte le bon lieu et la bonne date.
  db.run(
    `UPDATE sessions SET scheduled_date=?, scheduled_time=?, location=?,
     selected_attendee_ids=COALESCE(?, selected_attendee_ids),
     active_list_code=COALESCE(?, active_list_code)
     WHERE seance_id=? AND status != 'closed'`,
    [
      donnees.scheduledDate || maintenant.split('T')[0],
      donnees.scheduledTime || '14:30',
      donnees.location || '',
      convoquesJson,
      donnees.activeListCode || null,
      id,
    ]
  );

  saveDbToDisk();
  return getSeanceById(id)!;
}

/** Affiche une autre séance sur la table. */
export function basculerSeance(seanceId: string): Seance | null {
  const seance = getSeanceById(seanceId);
  if (!seance) throw new Error('Séance introuvable.');
  if (seance.closedAt) throw new Error('Une séance clôturée ne peut pas être réaffichée pour voter.');

  db.run("UPDATE seances SET is_current_active = 0");
  db.run("UPDATE seances SET is_current_active = 1 WHERE id = ?", [seanceId]);

  // Les convoqués de la séance doivent avoir une ligne d'émargement sur chacune
  // de ses résolutions encore ouvrables.
  const voters = getAllVoters();
  const convoques = seance.selectedAttendeeIds.length > 0
    ? seance.selectedAttendeeIds
    : voters.filter(v => v.isActive).map(v => v.id);
  seance.resolutions
    .filter(r => r.status !== 'closed')
    .forEach(r => {
      convoques.forEach(vid => {
        db.run(
          `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
          [r.id, vid]
        );
      });
    });

  sanitizeActiveSessions();
  saveDbToDisk();
  return getSeanceById(seanceId);
}

/**
 * Clôture la séance : elle est scellée, et les liens de vote nominatifs
 * n'ont plus d'objet. Les résolutions encore ouvertes doivent avoir été
 * clôturées avant — on ne scelle pas une réunion sur un scrutin en cours.
 */
export function cloturerSeance(seanceId: string): Seance {
  const seance = getSeanceById(seanceId);
  if (!seance) throw new Error('Séance introuvable.');
  if (seance.closedAt) throw new Error('Cette séance est déjà clôturée.');

  const ouverte = seance.resolutions.find(r => r.status === 'open');
  if (ouverte) {
    throw new Error(
      `La résolution « ${ouverte.title} » est encore ouverte au vote : clôturez-la avant de clore la séance.`
    );
  }

  const maintenant = new Date().toISOString();
  db.run("UPDATE seances SET closed_at=?, is_current_active=0 WHERE id=?", [maintenant, seanceId]);
  // Une résolution restée à l'état de projet n'a pas été soumise : elle est
  // classée sans suite plutôt que laissée en suspens.
  db.run(
    "UPDATE sessions SET status='closed', outcome='pending', closed_at=? WHERE seance_id=? AND status='draft'",
    [maintenant, seanceId]
  );
  revoquerJetonsVote(seanceId);
  sanitizeActiveSessions();
  saveDbToDisk();
  return getSeanceById(seanceId)!;
}

/** Supprime une séance et tout ce qu'elle porte. Une séance clôturée est scellée. */
export function supprimerSeance(seanceId: string): boolean {
  const seance = getSeanceById(seanceId);
  if (!seance) return false;
  if (seance.closedAt) throw new Error('Une séance clôturée est scellée : elle ne peut pas être supprimée.');

  seance.resolutions.forEach(r => {
    db.run("DELETE FROM session_voter_states WHERE session_id = ?", [r.id]);
  });
  db.run("DELETE FROM sessions WHERE seance_id = ?", [seanceId]);
  db.run("DELETE FROM jetons_vote WHERE seance_id = ?", [seanceId]);
  db.run("DELETE FROM seances WHERE id = ?", [seanceId]);

  sanitizeActiveSessions();
  saveDbToDisk();
  return true;
}

/**
 * Ajoute une résolution à une séance. C'est le geste attendu en cours de
 * réunion : un point s'ajoute à l'ordre du jour, et devient la résolution
 * présentée sur la table. Comme toute résolution, elle naît fermée au vote.
 */
export function ajouterResolution(
  seanceId: string,
  donnees: Partial<VotingSession> & { attendeeIds?: string[] }
): VotingSession {
  const seance = getSeanceById(seanceId);
  if (!seance) throw new Error('Séance introuvable.');
  if (seance.closedAt) throw new Error('Cette séance est clôturée : on ne peut plus y ajouter de résolution.');

  const ordre = seance.resolutions.reduce((max, r) => Math.max(max, r.ordre || 0), 0) + 1;
  const id = donnees.id || `resolution_${Date.now()}`;
  const maintenant = new Date().toISOString();
  const convoques =
    donnees.attendeeIds && donnees.attendeeIds.length > 0
      ? donnees.attendeeIds
      : seance.selectedAttendeeIds.length > 0
        ? seance.selectedAttendeeIds
        : getAllVoters().filter(v => v.isActive).map(v => v.id);

  db.run(
    `INSERT INTO sessions (
      id, seance_id, ordre, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
      status, majority_required, quorum_pct, is_secret, outcome, created_at, closed_at,
      is_current_active, selected_attendee_ids, active_list_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, 'pending', ?, NULL, 0, ?, ?)`,
    [
      id,
      seanceId,
      ordre,
      donnees.referenceCode || `${seance.referenceCode}/R${ordre}`,
      donnees.title || `Résolution n° ${ordre}`,
      donnees.motionText || '',
      seance.scheduledDate,
      seance.scheduledTime,
      seance.location,
      donnees.majorityRequired || 'simple',
      donnees.quorumPct ?? 0,
      donnees.isSecret ? 1 : 0,
      maintenant,
      JSON.stringify(convoques),
      donnees.activeListCode || seance.activeListCode || null,
    ]
  );

  // L'émargement est celui de la séance : la nouvelle résolution reprend les
  // présences et les procurations déjà constatées, sans bulletin.
  const reference = seance.resolutions
    .slice()
    .reverse()
    .find(r => r.status !== 'closed') || seance.resolutions[seance.resolutions.length - 1];
  const emargement = reference ? getSessionById(reference.id)?.voterStates : undefined;

  convoques.forEach(vid => {
    const etat = emargement?.[vid];
    db.run(
      `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, proxy_to_id, vote_choice)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, vid, etat?.presence || 'present', etat?.proxyToId || null]
    );
  });

  db.run("UPDATE seances SET resolution_courante_id=? WHERE id=?", [id, seanceId]);
  db.run("UPDATE seances SET is_current_active=0");
  db.run("UPDATE seances SET is_current_active=1 WHERE id=?", [seanceId]);
  sanitizeActiveSessions();
  saveDbToDisk();
  return getSessionById(id)!;
}

/** Présente une autre résolution sur la table, sans rien ouvrir ni fermer. */
export function basculerResolution(resolutionId: string): VotingSession | null {
  const resolution = getSessionById(resolutionId);
  if (!resolution) throw new Error('Résolution introuvable.');

  db.run("UPDATE seances SET resolution_courante_id=? WHERE id=?", [resolutionId, resolution.seanceId]);
  db.run("UPDATE seances SET is_current_active=0");
  db.run("UPDATE seances SET is_current_active=1 WHERE id=?", [resolution.seanceId]);
  sanitizeActiveSessions();
  saveDbToDisk();
  return getSessionById(resolutionId);
}

/** Réordonne les résolutions d'une séance selon la liste d'identifiants reçue. */
export function reordonnerResolutions(seanceId: string, ordreIds: string[]): Seance {
  ordreIds.forEach((id, i) => {
    db.run("UPDATE sessions SET ordre=? WHERE id=? AND seance_id=?", [i + 1, id, seanceId]);
  });
  saveDbToDisk();
  return getSeanceById(seanceId)!;
}

function meetingsDepuis(sql: string, params: any[] = []): MeetingItem[] {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const cols = res[0].columns;
  const idSeanceActive = db.exec("SELECT id FROM seances WHERE is_current_active = 1 LIMIT 1");
  const seanceActive = idSeanceActive.length && idSeanceActive[0].values.length
    ? String(idSeanceActive[0].values[0][0])
    : null;

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
      seanceId: s.seance_id || '',
      ordre: Number(s.ordre) || 1,
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
      seanceActive: seanceActive !== null && s.seance_id === seanceActive,
      activeListCode: s.active_list_code || undefined,
    };
  });
}

export function getAllMeetings(): MeetingItem[] {
  sanitizeActiveSessions();
  return meetingsDepuis(
    `SELECT s.* FROM sessions s LEFT JOIN seances se ON se.id = s.seance_id
     ORDER BY se.is_current_active DESC, se.scheduled_date DESC, se.created_at DESC, s.ordre ASC`
  );
}

/** Charge une résolution précise par son identifiant, bulletins compris. */
export function getSessionById(sessionId: string): VotingSession | null {
  const res = db.exec("SELECT * FROM sessions WHERE id = ? LIMIT 1", [sessionId]);
  if (!res.length || !res[0].values.length) return null;
  return hydrateSession(res[0].columns, res[0].values[0]);
}

/**
 * La résolution présentée sur la table : celle de la séance affichée, courante
 * au sens de l'ordre du jour. Elle peut être clôturée — on continue alors d'en
 * montrer le résultat, jusqu'à ce qu'on passe à la suivante.
 */
export function getActiveSession(): VotingSession | null {
  const seanceId = seanceActiveId();
  if (!seanceId) return null;

  const res = db.exec(
    "SELECT s.* FROM sessions s JOIN seances se ON se.resolution_courante_id = s.id WHERE se.id = ? LIMIT 1",
    [seanceId]
  );
  if (res.length && res[0].values.length) return hydrateSession(res[0].columns, res[0].values[0]);

  const repli = db.exec(
    "SELECT * FROM sessions WHERE seance_id = ? ORDER BY ordre ASC LIMIT 1",
    [seanceId]
  );
  if (repli.length && repli[0].values.length) return hydrateSession(repli[0].columns, repli[0].values[0]);
  return null;
}

/** Construit une VotingSession à partir d'une ligne SQL de `sessions`. */
function hydrateSession(cols: string[], row: any[]): VotingSession {
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
    seanceId: s.seance_id || '',
    ordre: Number(s.ordre) || 1,
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

/**
 * Présente une résolution sur la table, en basculant au besoin sur sa séance.
 * Ni l'une ni l'autre n'est ouverte au vote par ce geste.
 */
export function switchActiveMeeting(meetingId: string): VotingSession | null {
  const resolution = getSessionById(meetingId);
  if (!resolution) throw new Error('Résolution introuvable.');

  const seance = getSeanceById(resolution.seanceId);
  if (seance?.closedAt) {
    throw new Error('Une séance scellée et clôturée ne peut pas être réactivée.');
  }
  if (resolution.status === 'closed' && !seance) {
    throw new Error('Une séance scellée et clôturée ne peut pas être réactivée.');
  }

  db.run("UPDATE seances SET is_current_active = 0");
  db.run("UPDATE seances SET is_current_active = 1 WHERE id = ?", [resolution.seanceId]);
  db.run("UPDATE seances SET resolution_courante_id = ? WHERE id = ?", [meetingId, resolution.seanceId]);

  const voters = getAllVoters();
  const attendeeIds = resolution.selectedAttendeeIds && resolution.selectedAttendeeIds.length > 0
    ? resolution.selectedAttendeeIds
    : voters.filter(v => v.isActive).map(v => v.id);

  if (resolution.status !== 'closed') {
    attendeeIds.forEach(vid => {
      db.run(
        `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
        [meetingId, vid]
      );
    });
  }

  sanitizeActiveSessions();
  saveDbToDisk();
  return getActiveSession();
}

/**
 * Crée ou met à jour une résolution.
 *
 * Sans `seanceId`, créer une résolution crée aussi la séance qui la porte : on
 * peut donc continuer à programmer une réunion d'un seul point sans rien savoir
 * du niveau « séance ». Pour ajouter un point à une réunion existante — le geste
 * courant en cours de séance — on passe par `ajouterResolution`.
 *
 * Le statut transmis par l'appelant est délibérément ignoré : une résolution
 * naît fermée au vote, et seule `definirOuvertureScrutin` — un geste explicite
 * de l'administrateur — l'ouvre. L'heure programmée n'est qu'un repère affiché.
 */
export function createOrUpdateSession(sessionData: Partial<VotingSession> & { attendeeIds?: string[]; seanceId?: string }): VotingSession {
  const id = sessionData.id || `session_${Date.now()}`;
  const now = new Date().toISOString();
  const existing = db.exec("SELECT id, seance_id FROM sessions WHERE id = ?", [id]);

  const attendeeIdsJson = sessionData.attendeeIds 
    ? JSON.stringify(sessionData.attendeeIds) 
    : sessionData.selectedAttendeeIds 
      ? JSON.stringify(sessionData.selectedAttendeeIds) 
      : null;

  if (existing.length && existing[0].values.length) {
    db.run(
      // Le statut n'est jamais touché ici. Enregistrer un ordre du jour n'ouvre ni
      // ne referme un scrutin : seule l'ouverture explicite le fait.
      `UPDATE sessions SET reference_code=?, title=?, motion_text=?, scheduled_date=?, scheduled_time=?, location=?, majority_required=?, quorum_pct=?, is_secret=?, outcome=?, closed_at=?, selected_attendee_ids=COALESCE(?, selected_attendee_ids), active_list_code=COALESCE(?, active_list_code) WHERE id=?`,
      [
        sessionData.referenceCode || 'CA-2026-08',
        sessionData.title || 'Ordre du jour',
        sessionData.motionText || '',
        sessionData.scheduledDate || now.split('T')[0],
        sessionData.scheduledTime || '14:30',
        sessionData.location || 'Salle du Conseil',
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

    // Une résolution seule dans sa séance en porte aussi les coordonnées : on
    // les tient alignées, sans quoi la liste des séances afficherait l'ancienne
    // date pendant que la table affiche la nouvelle.
    const seanceId = String(existing[0].values[0][1] || '');
    if (seanceId) {
      const fratrie = db.exec("SELECT COUNT(*) FROM sessions WHERE seance_id = ?", [seanceId]);
      if (Number(fratrie[0]?.values[0]?.[0]) === 1) {
        db.run(
          `UPDATE seances SET reference_code=?, title=?, scheduled_date=?, scheduled_time=?, location=?,
           selected_attendee_ids=COALESCE(?, selected_attendee_ids),
           active_list_code=COALESCE(?, active_list_code) WHERE id=?`,
          [
            racineReference(sessionData.referenceCode || 'CA-2026-08'),
            sessionData.title || 'Ordre du jour',
            sessionData.scheduledDate || now.split('T')[0],
            sessionData.scheduledTime || '14:30',
            sessionData.location || 'Salle du Conseil',
            attendeeIdsJson,
            sessionData.activeListCode || null,
            seanceId,
          ]
        );
      }
    }
  } else {
    // Nouvelle résolution : rattachée à la séance demandée, ou à une séance
    // créée pour l'occasion.
    let seanceId = sessionData.seanceId || '';
    if (seanceId && !getSeanceById(seanceId)) seanceId = '';
    if (!seanceId) {
      const seance = creerOuMajSeance({
        id: `seance_${id}`,
        referenceCode: racineReference(sessionData.referenceCode || 'CA-2026-08'),
        title: sessionData.title || 'Nouvelle Délibération',
        scheduledDate: sessionData.scheduledDate || now.split('T')[0],
        scheduledTime: sessionData.scheduledTime || '14:30',
        location: sessionData.location || 'Salle du Conseil',
        attendeeIds: sessionData.attendeeIds || sessionData.selectedAttendeeIds,
        activeListCode: sessionData.activeListCode,
      });
      seanceId = seance.id;
    }

    const rangRes = db.exec("SELECT COALESCE(MAX(ordre), 0) FROM sessions WHERE seance_id = ?", [seanceId]);
    const ordre = Number(rangRes[0]?.values[0]?.[0] || 0) + 1;

    db.run("UPDATE seances SET is_current_active = 0");
    db.run("UPDATE seances SET is_current_active = 1 WHERE id = ?", [seanceId]);
    db.run(
      `INSERT INTO sessions (
        id, seance_id, ordre, reference_code, title, motion_text, scheduled_date, scheduled_time, location,
        status, majority_required, quorum_pct, is_secret, outcome, created_at, closed_at,
        is_current_active, selected_attendee_ids, active_list_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        seanceId,
        ordre,
        sessionData.referenceCode || 'CA-2026-08',
        sessionData.title || 'Nouvelle Délibération',
        sessionData.motionText || '',
        sessionData.scheduledDate || now.split('T')[0],
        sessionData.scheduledTime || '14:30',
        sessionData.location || 'Salle du Conseil',
        // Une résolution nouvelle n'est jamais ouverte au vote, quelle que soit
        // l'heure annoncée : l'heure est un repère, pas un déclencheur.
        'draft',
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
    db.run("UPDATE seances SET resolution_courante_id = ? WHERE id = ?", [id, seanceId]);
  }

  // Chaque convoqué a sa ligne d'émargement sur ce vote.
  const voters = getAllVoters();
  const listeExplicite = sessionData.attendeeIds || sessionData.selectedAttendeeIds;
  const attendeeIds = listeExplicite || voters.map(v => v.id);
  attendeeIds.forEach(vid => {
    db.run(
      `INSERT OR IGNORE INTO session_voter_states (session_id, voter_id, presence, vote_choice) VALUES (?, ?, 'present', 'pending')`,
      [id, vid]
    );
  });

  /*
   * Et réciproquement : retirer quelqu'un de la convocation le retire de
   * l'émargement de ce vote. Sa ligne survivait, si bien que l'ordre du jour
   * continuait d'annoncer l'ancien effectif — « 0/28 suffrages » — pendant que
   * la table comptait le nouveau. Un scrutin clôturé n'est jamais touché :
   * son émargement est celui de la clôture, et il fait foi.
   */
  const dejaClos = db.exec("SELECT status FROM sessions WHERE id = ?", [id]);
  const estClos = String(dejaClos[0]?.values[0]?.[0] || '') === 'closed';
  if (listeExplicite && !estClos) {
    const restants = JSON.stringify(listeExplicite);
    db.run(
      `DELETE FROM session_voter_states
       WHERE session_id = ? AND voter_id NOT IN (SELECT value FROM json_each(?))`,
      [id, restants]
    );
    // Un pouvoir donné à quelqu'un qui n'est plus convoqué n'a plus d'objet.
    db.run(
      `UPDATE session_voter_states SET presence = 'absent', proxy_to_id = NULL
       WHERE session_id = ? AND proxy_to_id IS NOT NULL
         AND proxy_to_id NOT IN (SELECT voter_id FROM session_voter_states WHERE session_id = ?)`,
      [id, id]
    );
  }

  sanitizeActiveSessions();
  saveDbToDisk();
  return getSessionById(id)!;
}

/**
 * Supprime une résolution. Si c'était la dernière de sa séance, la séance part
 * avec elle : une réunion sans aucun point à l'ordre du jour n'existe pas.
 */
export function deleteMeeting(id: string): boolean {
  const resolution = getSessionById(id);
  const seanceId = resolution?.seanceId || null;

  db.run("DELETE FROM sessions WHERE id = ?", [id]);
  db.run("DELETE FROM session_voter_states WHERE session_id = ?", [id]);
  db.run("DELETE FROM jetons_vote WHERE session_id = ?", [id]);

  if (seanceId) {
    const reste = db.exec("SELECT COUNT(*) FROM sessions WHERE seance_id = ?", [seanceId]);
    if (Number(reste[0]?.values[0]?.[0] || 0) === 0) {
      db.run("DELETE FROM jetons_vote WHERE seance_id = ?", [seanceId]);
      db.run("DELETE FROM seances WHERE id = ?", [seanceId]);
    } else {
      const courante = db.exec("SELECT resolution_courante_id FROM seances WHERE id = ?", [seanceId]);
      if (String(courante[0]?.values[0]?.[0] || '') === id) {
        db.run("UPDATE seances SET resolution_courante_id = NULL WHERE id = ?", [seanceId]);
      }
    }
  }

  // Si la séance supprimée était celle affichée sur la table, on désigne une
  // remplaçante — mais seulement parmi les séances encore ouvrables. Une séance
  // clôturée est scellée : la réactiver échouerait, et l'échec surviendrait
  // APRÈS la suppression, laissant l'écran et le registre en désaccord.
  sanitizeActiveSessions();
  const seances = getAllSeances();
  if (seances.length > 0 && !seances.some(se => se.surLaTable)) {
    const remplacante = seances.find(se => !se.closedAt);
    if (remplacante) basculerSeance(remplacante.id);
  }

  saveDbToDisk();
  return true;
}

/** Duplique une résolution, dans une nouvelle séance à elle. */
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

/**
 * Ouvre ou suspend le scrutin d'une séance.
 *
 * « Séance active » et « scrutin ouvert » sont deux choses distinctes : la séance
 * active est celle qui s'affiche sur la table, le scrutin ouvert est celui qui
 * accepte des bulletins. L'ouverture est un geste délibéré du président — il peut
 * ouvrir avant l'heure annoncée s'il le décide, l'heure n'est qu'un repère.
 */
export function definirOuvertureScrutin(sessionId: string, ouvert: boolean): VotingSession | null {
  const seance = getSessionById(sessionId);
  if (!seance) throw new Error('Séance introuvable.');
  if (seance.status === 'closed') {
    throw new Error('Cette séance est clôturée : son scrutin ne peut plus être rouvert.');
  }
  db.run("UPDATE sessions SET status=? WHERE id=?", [ouvert ? 'open' : 'draft', sessionId]);
  saveDbToDisk();
  return getSessionById(sessionId);
}

// Live Session state modifiers
export function updateVoterVote(sessionId: string, voterId: string, vote: string): VotingSession | null {
  // Un suffrage n'est recevable que pendant que le scrutin est ouvert. Une séance
  // seulement programmée, ou déjà clôturée, ne peut pas recevoir de bulletin.
  const seance = getSessionById(sessionId);
  if (!seance) throw new Error('Séance introuvable.');
  if (seance.status === 'closed') {
    throw new Error('Cette séance est clôturée : aucun suffrage ne peut plus être enregistré.');
  }
  if (seance.status !== 'open') {
    throw new Error("Le scrutin n'est pas ouvert. Ouvrez-le depuis la table avant de faire voter.");
  }

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
  return getSessionById(sessionId);
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

  /*
   * On émarge une fois pour la séance, pas une fois par résolution : la présence
   * et les procurations valent pour tous les points de l'ordre du jour encore
   * ouvrables. Les résolutions déjà clôturées gardent, elles, l'émargement
   * constaté au moment de leur clôture — c'est ce qui figure à leur PV.
   */
  const cibles = [sessionId];
  const seanceId = seanceDeResolution(sessionId);
  if (seanceId) {
    const fratrie = db.exec(
      "SELECT id FROM sessions WHERE seance_id = ? AND status != 'closed' AND id != ?",
      [seanceId, sessionId]
    );
    if (fratrie.length && fratrie[0].values.length) {
      fratrie[0].values.forEach(row => cibles.push(String(row[0])));
    }
  }

  cibles.forEach(cible => {
    db.run(
      `INSERT INTO session_voter_states (session_id, voter_id, presence, proxy_to_id, vote_choice)
       VALUES (?, ?, ?, ?, 'pending')
       ON CONFLICT(session_id, voter_id) DO UPDATE SET presence=?, proxy_to_id=?`,
      [cible, voterId, presence, actualProxyToId, presence, actualProxyToId]
    );
  });

  saveDbToDisk();
  return getSessionById(sessionId);
}

export function resetSessionVotes(sessionId: string): VotingSession | null {
  db.run(
    `UPDATE session_voter_states SET vote_choice='pending', voted_at=NULL WHERE session_id=?`,
    [sessionId]
  );
  // Les suffrages repartent de zéro : les liens de vote redeviennent utilisables,
  // sinon un membre ayant déjà voté ne pourrait plus se prononcer sur le nouveau tour.
  const seanceRemiseAZero = seanceDeResolution(sessionId);
  db.run(`UPDATE jetons_vote SET utilise_le=NULL WHERE session_id=? OR seance_id=?`, [
    sessionId,
    seanceRemiseAZero || '',
  ]);
  // La remise à zéro efface les suffrages, elle n'ouvre rien : c'est à
  // l'administrateur de rouvrir le scrutin s'il veut un nouveau tour.
  db.run(
    `UPDATE sessions SET status='draft', outcome='pending', closed_at=NULL WHERE id=?`,
    [sessionId]
  );
  saveDbToDisk();
  return getSessionById(sessionId);
}

/**
 * Clôture une séance. Le résultat officiel est recalculé ICI, à partir des bulletins
 * en base : rien de ce que le navigateur envoie n'est retenu pour le procès-verbal.
 */
export function archiveAndCloseSession(sessionId: string): { history: SessionHistoryItem; stats: VoteStatistics } {
  const session = getSessionById(sessionId);
  if (!session) throw new Error('Séance introuvable');
  if (session.status === 'closed') throw new Error('Cette séance est déjà clôturée.');

  const voters = getAllVoters();
  const stats = calculateVoteStatistics(session, voters, { finaliser: true });
  const now = new Date().toISOString();

  // Règle D5 : les présents n'ayant pas voté sont inscrits au registre comme abstentions,
  // pour que le détail nominatif du PV concorde avec le décompte publié.
  if (stats.abstentionsAssimilees > 0) {
    db.run(
      `UPDATE session_voter_states SET vote_choice='abstain'
       WHERE session_id=? AND vote_choice='pending' AND presence IN ('present','proxy')`,
      [sessionId]
    );
  }
  const sessionFigee = getSessionById(sessionId) || session;
  const voterStatesList: VoterSessionState[] = Object.values(sessionFigee.voterStates);

  db.run(
    `UPDATE sessions SET status='closed', outcome=?, closed_at=? WHERE id=?`,
    [stats.outcome, now, sessionId]
  );

  /*
   * On reste sur la résolution qu'on vient de clôturer : c'est son résultat que
   * la table doit montrer, et son procès-verbal qu'on édite dans la foulée. Le
   * passage au point suivant est un geste distinct.
   *
   * Les liens de vote, eux, valent pour la séance entière : ils survivent à la
   * clôture d'une résolution, de sorte qu'un membre qui a scanné une fois vote
   * sur chaque point sans rescanner. Ils ne tombent qu'à la clôture de la séance.
   */
  if (session.seanceId) {
    db.run("UPDATE seances SET resolution_courante_id=? WHERE id=?", [sessionId, session.seanceId]);
  }

  const historyId = `hist_${Date.now()}`;
  const detailedSnapshot = {
    session: { ...sessionFigee, status: 'closed' as const, outcome: stats.outcome, closedAt: now },
    stats,
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

  const history: SessionHistoryItem = {
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

  return { history, stats };
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

/*
 * Appareils de confiance.
 *
 * Le poste de séance ne doit pas réclamer le code à chaque ouverture, ni après
 * chaque redémarrage du service. On y dépose donc un jeton valable sept jours ;
 * la base n'en conserve que l'empreinte, jamais le jeton lui-même, de sorte
 * qu'une lecture de la base ne permette pas de se faire passer pour l'appareil.
 * L'échéance glisse à chaque usage : un poste utilisé chaque semaine ne
 * redemande jamais le code, un poste oublié cesse d'être reconnu.
 */
export function enregistrerAppareil(empreinte: string, libelle: string, joursValidite: number): void {
  const maintenant = new Date();
  const expire = new Date(maintenant.getTime() + joursValidite * 24 * 60 * 60 * 1000);
  db.run(
    `INSERT INTO appareils_confiance (empreinte, libelle, cree_le, expire_le, dernier_usage)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(empreinte) DO UPDATE SET expire_le=?, dernier_usage=?`,
    [
      empreinte, libelle, maintenant.toISOString(), expire.toISOString(), maintenant.toISOString(),
      expire.toISOString(), maintenant.toISOString(),
    ]
  );
  saveDbToDisk();
}

/** Renvoie vrai si l'empreinte correspond à un appareil encore reconnu, et prolonge son échéance. */
export function verifierAppareil(empreinte: string, joursValidite: number): boolean {
  const res = db.exec("SELECT expire_le FROM appareils_confiance WHERE empreinte = ?", [empreinte]);
  if (!res.length || !res[0].values.length) return false;

  const expire = new Date(String(res[0].values[0][0]));
  if (Number.isNaN(expire.getTime()) || expire.getTime() <= Date.now()) {
    db.run("DELETE FROM appareils_confiance WHERE empreinte = ?", [empreinte]);
    saveDbToDisk();
    return false;
  }

  enregistrerAppareil(empreinte, '', joursValidite);
  return true;
}

export function oublierAppareil(empreinte: string): void {
  db.run("DELETE FROM appareils_confiance WHERE empreinte = ?", [empreinte]);
  saveDbToDisk();
}

/** Retire les appareils dont l'échéance est passée. Appelé au démarrage. */
export function purgerAppareilsExpires(): void {
  db.run("DELETE FROM appareils_confiance WHERE expire_le <= ?", [new Date().toISOString()]);
  saveDbToDisk();
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
  db.run("DROP TABLE IF EXISTS seances");
  db.run("DROP TABLE IF EXISTS jetons_vote");
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

/* ------------------------------------------------------------------
 * Liens de vote nominatifs (QR code)
 *
 * Chaque membre convoqué reçoit un lien qui n'ouvre qu'une seule page : la
 * sienne, pour la séance en cours, valable un jour, et qui n'accepte qu'un seul
 * bulletin. Le QR code n'est montré que sur l'écran de la salle : le tenir en
 * main suppose d'être présent, ce qui reste la règle « salle uniquement ».
 *
 * Contrairement au jeton d'appareil, le jeton de vote est conservé en clair :
 * l'administrateur doit pouvoir réafficher le MÊME QR code plusieurs fois dans
 * la séance. Sa portée est étroite — un votant, une séance, un jour, un bulletin —
 * et la base n'est lisible que depuis le serveur.
 * ------------------------------------------------------------------ */

export const HEURES_VALIDITE_LIEN = 24;

export interface JetonVote {
  jeton: string;
  /** Colonne historique : elle porte désormais l'identifiant de la séance. */
  sessionId: string;
  seanceId: string;
  voterId: string;
  creeLe: string;
  expireLe: string;
  utiliseLe: string | null;
}

function ligneVersJeton(cols: string[], row: any[]): JetonVote {
  const o: any = {};
  cols.forEach((c, i) => { o[c] = row[i]; });
  return {
    jeton: String(o.jeton),
    sessionId: String(o.session_id),
    seanceId: String(o.seance_id || o.session_id),
    voterId: String(o.voter_id),
    creeLe: String(o.cree_le),
    expireLe: String(o.expire_le),
    utiliseLe: o.utilise_le ? String(o.utilise_le) : null,
  };
}

/** Retire les liens périmés. Appelé au démarrage et avant chaque distribution. */
export function purgerJetonsVoteExpires(): void {
  db.run("DELETE FROM jetons_vote WHERE expire_le <= ?", [new Date().toISOString()]);
  saveDbToDisk();
}

/**
 * Renvoie le lien du membre pour cette séance, en le créant s'il n'existe pas
 * encore ou s'il est périmé. Un lien encore valide n'est jamais remplacé : un
 * membre qui a déjà scanné doit pouvoir voter même si l'écran réaffiche son QR.
 */
export function jetonVotePour(
  seanceOuResolutionId: string,
  voterId: string,
  dureeHeures: number = HEURES_VALIDITE_LIEN
): JetonVote {
  // On accepte l'identifiant d'une résolution comme celui d'une séance : le lien
  // vaut de toute façon pour la séance entière.
  const seanceId = seanceDeResolution(seanceOuResolutionId) || seanceOuResolutionId;
  const maintenant = new Date();
  const res = db.exec(
    "SELECT * FROM jetons_vote WHERE seance_id = ? AND voter_id = ?",
    [seanceId, voterId]
  );

  if (res.length && res[0].values.length) {
    const existant = ligneVersJeton(res[0].columns, res[0].values[0]);
    if (new Date(existant.expireLe).getTime() > maintenant.getTime()) return existant;
    db.run("DELETE FROM jetons_vote WHERE jeton = ?", [existant.jeton]);
  }

  const nouveau: JetonVote = {
    jeton: crypto.randomBytes(24).toString('base64url'),
    sessionId: seanceId,
    seanceId,
    voterId,
    creeLe: maintenant.toISOString(),
    expireLe: new Date(maintenant.getTime() + dureeHeures * 3600 * 1000).toISOString(),
    utiliseLe: null,
  };
  db.run(
    `INSERT INTO jetons_vote (jeton, session_id, seance_id, voter_id, cree_le, expire_le, utilise_le)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [nouveau.jeton, seanceId, seanceId, nouveau.voterId, nouveau.creeLe, nouveau.expireLe]
  );
  saveDbToDisk();
  return nouveau;
}

export function lireJetonVote(jeton: string): JetonVote | null {
  const res = db.exec("SELECT * FROM jetons_vote WHERE jeton = ?", [jeton]);
  if (!res.length || !res[0].values.length) return null;
  const trouve = ligneVersJeton(res[0].columns, res[0].values[0]);
  if (new Date(trouve.expireLe).getTime() <= Date.now()) {
    db.run("DELETE FROM jetons_vote WHERE jeton = ?", [trouve.jeton]);
    saveDbToDisk();
    return null;
  }
  return trouve;
}

/** Efface tous les liens d'une séance : à sa clôture, ils n'ont plus d'objet. */
export function revoquerJetonsVote(seanceOuResolutionId: string): void {
  const seanceId = seanceDeResolution(seanceOuResolutionId) || seanceOuResolutionId;
  db.run("DELETE FROM jetons_vote WHERE seance_id = ? OR session_id = ?", [seanceId, seanceOuResolutionId]);
  saveDbToDisk();
}

/**
 * Résolution sur laquelle porte actuellement un lien de vote : celle qui est
 * ouverte au vote dans la séance. À défaut, celle présentée sur la table.
 * C'est ce qui permet à un membre de garder sa page ouverte d'un point de
 * l'ordre du jour au suivant.
 */
export function resolutionDuJeton(seanceId: string): VotingSession | null {
  const ouverte = db.exec(
    "SELECT * FROM sessions WHERE seance_id = ? AND status = 'open' ORDER BY ordre ASC LIMIT 1",
    [seanceId]
  );
  if (ouverte.length && ouverte[0].values.length) {
    return hydrateSession(ouverte[0].columns, ouverte[0].values[0]);
  }

  const courante = db.exec(
    "SELECT s.* FROM sessions s JOIN seances se ON se.resolution_courante_id = s.id WHERE se.id = ? LIMIT 1",
    [seanceId]
  );
  if (courante.length && courante[0].values.length) {
    return hydrateSession(courante[0].columns, courante[0].values[0]);
  }

  const premiere = db.exec(
    "SELECT * FROM sessions WHERE seance_id = ? ORDER BY CASE WHEN status='closed' THEN 1 ELSE 0 END, ordre ASC LIMIT 1",
    [seanceId]
  );
  if (premiere.length && premiere[0].values.length) {
    return hydrateSession(premiere[0].columns, premiere[0].values[0]);
  }
  return null;
}

/**
 * Enregistre le bulletin déposé depuis le téléphone d'un membre.
 *
 * Toutes les conditions de recevabilité sont vérifiées ICI, côté serveur : le
 * téléphone ne fait qu'appuyer sur un bouton, il ne décide de rien. L'unicité du
 * bulletin se juge résolution par résolution : le lien vaut pour la séance, mais
 * on ne vote qu'une fois sur chaque point de l'ordre du jour.
 */
export function voterAvecJeton(
  jeton: string,
  vote: 'for' | 'against' | 'abstain'
): { session: VotingSession; voterId: string; pouvoirs: number } {
  const lien = lireJetonVote(jeton);
  if (!lien) throw new Error("Ce lien de vote n'est plus valable. Demandez à l'administrateur de séance.");

  const seance = getSeanceById(lien.seanceId);
  if (seance?.closedAt) throw new Error('La séance est clôturée : votre suffrage ne peut plus être enregistré.');

  const resolution = resolutionDuJeton(lien.seanceId);
  if (!resolution) throw new Error('Séance introuvable.');
  if (resolution.status === 'closed') throw new Error('Le scrutin est clôturé : votre suffrage ne peut plus être enregistré.');
  if (resolution.status !== 'open') throw new Error("Le scrutin n'est pas encore ouvert. Patientez, la page se mettra à jour.");

  const etat = resolution.voterStates[lien.voterId];
  if (!etat) throw new Error("Vous ne figurez pas parmi les membres convoqués à cette séance.");
  if (etat.presence === 'absent' || etat.presence === 'excused') {
    throw new Error("Vous n'êtes pas émargé présent. Signalez-vous à l'administrateur de séance.");
  }
  if (etat.presence === 'proxy') {
    throw new Error('Vous avez donné pouvoir à un autre membre : c\'est lui qui vote pour vous.');
  }
  if (etat.vote && etat.vote !== 'pending') {
    throw new Error('Votre suffrage a déjà été enregistré : on ne vote qu\'une fois sur cette résolution.');
  }

  const sessionId = resolution.id;
  const maintenant = new Date().toISOString();
  db.run(
    `INSERT INTO session_voter_states (session_id, voter_id, presence, vote_choice, voted_at)
     VALUES (?, ?, 'present', ?, ?)
     ON CONFLICT(session_id, voter_id) DO UPDATE SET vote_choice=?, voted_at=?`,
    [sessionId, lien.voterId, vote, maintenant, vote, maintenant]
  );

  // Les pouvoirs reçus suivent le vote du mandataire, exactement comme lorsque
  // l'administrateur vote à sa place depuis la table.
  db.run(
    `UPDATE session_voter_states SET vote_choice=?, voted_at=?
     WHERE session_id=? AND proxy_to_id=? AND presence='proxy'`,
    [vote, maintenant, sessionId, lien.voterId]
  );

  db.run("UPDATE jetons_vote SET utilise_le=? WHERE jeton=?", [maintenant, jeton]);
  saveDbToDisk();

  const apres = getSessionById(sessionId)!;
  const pouvoirs = Object.values(apres.voterStates).filter(
    (e) => e.presence === 'proxy' && e.proxyToId === lien.voterId
  ).length;

  return { session: apres, voterId: lien.voterId, pouvoirs };
}

/**
 * Tout ce que la page mobile d'un votant a le droit de connaître, pour la
 * résolution en cours. Le téléphone interroge cette route en boucle : quand la
 * séance passe au point suivant, la page suit toute seule, sans nouveau scan.
 */
export function contexteVotant(jeton: string): {
  seance: { referenceCode: string; title: string; motionText: string; scheduledDate: string; scheduledTime: string; location: string; status: SessionStatus; isSecret: boolean };
  /** Résolution en cours : son identifiant change quand la séance passe au point suivant. */
  resolution: { id: string; ordre: number; total: number; referenceCode: string; title: string };
  seanceClose: boolean;
  votant: { name: string; title: string; seatNumber: number };
  presence: string;
  aVote: boolean;
  choix: string | null;
  pouvoirs: { name: string; title: string }[];
  expireLe: string;
} | null {
  const lien = lireJetonVote(jeton);
  if (!lien) return null;

  const seanceMere = getSeanceById(lien.seanceId);
  const resolution = resolutionDuJeton(lien.seanceId);
  if (!resolution) return null;

  const voters = getAllVoters();
  const votant = voters.find((v) => v.id === lien.voterId);
  if (!votant) return null;

  const etat = resolution.voterStates[lien.voterId] || { presence: 'absent', vote: 'pending' };
  const pouvoirs = Object.entries(resolution.voterStates)
    .filter(([, e]) => e.presence === 'proxy' && e.proxyToId === lien.voterId)
    .map(([id]) => voters.find((v) => v.id === id))
    .filter((v): v is Voter => Boolean(v))
    .map((v) => ({ name: v.name, title: v.title }));

  // Un bulletin déposé sur CETTE résolution : le lien, lui, sert toute la séance.
  const aVote = etat.vote !== 'pending' && etat.vote !== 'secret';

  return {
    seance: {
      referenceCode: resolution.referenceCode,
      title: resolution.title,
      motionText: resolution.motionText,
      scheduledDate: resolution.scheduledDate,
      scheduledTime: resolution.scheduledTime,
      location: resolution.location,
      status: resolution.status,
      isSecret: resolution.isSecret,
    },
    resolution: {
      id: resolution.id,
      ordre: resolution.ordre,
      total: seanceMere ? seanceMere.resolutions.length : 1,
      referenceCode: resolution.referenceCode,
      title: resolution.title,
    },
    seanceClose: Boolean(seanceMere?.closedAt),
    votant: { name: votant.name, title: votant.title, seatNumber: votant.seatNumber },
    presence: etat.presence,
    aVote,
    // En scrutin secret, le téléphone n'affiche jamais le sens du bulletin déposé.
    choix: aVote && !resolution.isSecret ? etat.vote : null,
    pouvoirs,
    expireLe: lien.expireLe,
  };
}
