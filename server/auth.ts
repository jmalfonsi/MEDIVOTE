import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Authentification MediVote.
 *
 * Le code administrateur ne vit plus dans le code livré au navigateur : il est lu
 * dans l'environnement du serveur, comparé en temps constant, et échangé contre un
 * jeton de session à durée limitée. Le navigateur ne connaît jamais le code après
 * la saisie initiale.
 *
 * Deux rôles sont prévus : `admin` (pilotage de la séance) et `votant` (un membre
 * qui vote pour lui-même, via un lien nominatif). Seul `admin` est délivré
 * aujourd'hui ; la porte est en place pour les liens de vote par QR code.
 */

export type Role = 'admin' | 'votant';

export interface Jeton {
  valeur: string;
  role: Role;
  voterId?: string;
  expireA: number;
}

const DUREE_SESSION_MS = 12 * 60 * 60 * 1000; // une journée de séance
const PIN_DEV_PAR_DEFAUT = '582103';
const MAX_TENTATIVES = 5;
const VERROU_MS = 5 * 60 * 1000;

export const NOM_COOKIE = 'mv_session';

const jetons = new Map<string, Jeton>();
const tentatives = new Map<string, { echecs: number; verrouJusqua: number }>();

function pinAttendu(): string {
  const pin = process.env.MEDIVOTE_ADMIN_PIN;
  if (pin && pin.length > 0) return pin;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MEDIVOTE_ADMIN_PIN doit être défini en production : refus de démarrer avec un code par défaut.'
    );
  }
  return PIN_DEV_PAR_DEFAUT;
}

/** Vérifie la configuration au démarrage, pour échouer tout de suite plutôt qu'en séance. */
export function verifierConfiguration(): void {
  const pin = pinAttendu();
  if (process.env.NODE_ENV !== 'production' && pin === PIN_DEV_PAR_DEFAUT) {
    console.warn(
      '[MediVote] Code administrateur de développement en usage. Définissez MEDIVOTE_ADMIN_PIN avant toute séance réelle.'
    );
  }
}

function comparaisonConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // On compare quand même, pour ne pas révéler la longueur par le temps de réponse.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function purger(): void {
  const maintenant = Date.now();
  jetons.forEach((jeton, cle) => {
    if (jeton.expireA <= maintenant) jetons.delete(cle);
  });
}

export function creerJeton(role: Role, voterId?: string): Jeton {
  purger();
  const jeton: Jeton = {
    valeur: crypto.randomBytes(32).toString('base64url'),
    role,
    voterId,
    expireA: Date.now() + DUREE_SESSION_MS,
  };
  jetons.set(jeton.valeur, jeton);
  return jeton;
}

function valeurBrute(req: Request): string | null {
  const entete = req.headers.authorization;
  if (entete && entete.startsWith('Bearer ')) return entete.slice(7);

  // Le flux temps réel (EventSource) ne peut pas porter d'en-tête : il s'appuie
  // sur le cookie de session, posé httpOnly et SameSite=Strict.
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const morceau of brut.split(';')) {
    const sep = morceau.indexOf('=');
    if (sep === -1) continue;
    if (morceau.slice(0, sep).trim() === NOM_COOKIE) {
      return decodeURIComponent(morceau.slice(sep + 1).trim());
    }
  }
  return null;
}

export function lireJeton(req: Request): Jeton | null {
  const valeur = valeurBrute(req);
  if (!valeur) return null;
  const jeton = jetons.get(valeur);
  if (!jeton) return null;
  if (jeton.expireA <= Date.now()) {
    jetons.delete(jeton.valeur);
    return null;
  }
  return jeton;
}

export function revoquerJeton(req: Request): void {
  const valeur = valeurBrute(req);
  if (valeur) jetons.delete(valeur);
}

/** Cookie de session : inaccessible au JavaScript, non transmis aux sites tiers. */
export function poserCookie(res: Response, jeton: Jeton): void {
  const secondes = Math.floor((jeton.expireA - Date.now()) / 1000);
  const options = [
    `${NOM_COOKIE}=${encodeURIComponent(jeton.valeur)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${secondes}`,
  ];
  if (process.env.MEDIVOTE_COOKIE_SECURE === 'true') options.push('Secure');
  res.setHeader('Set-Cookie', options.join('; '));
}

export function effacerCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${NOM_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

/**
 * Échange le code administrateur contre un jeton de session.
 * Après 5 échecs, le poste est verrouillé 5 minutes : un code à 6 chiffres ne
 * résiste pas à un essai illimité.
 */
export function authentifierAdmin(pinSaisi: string, empreintePoste: string): Jeton {
  const etat = tentatives.get(empreintePoste);
  if (etat && etat.verrouJusqua > Date.now()) {
    const minutes = Math.ceil((etat.verrouJusqua - Date.now()) / 60000);
    throw new Error(`Trop de tentatives. Nouvel essai possible dans ${minutes} min.`);
  }

  if (!comparaisonConstante(String(pinSaisi ?? ''), pinAttendu())) {
    const echecs = (etat?.echecs ?? 0) + 1;
    tentatives.set(empreintePoste, {
      echecs,
      verrouJusqua: echecs >= MAX_TENTATIVES ? Date.now() + VERROU_MS : 0,
    });
    throw new Error('Code administrateur incorrect.');
  }

  tentatives.delete(empreintePoste);
  return creerJeton('admin');
}

/** Barre l'accès aux requêtes sans jeton administrateur valide. */
export function exigerAdmin(req: Request, res: Response, next: NextFunction): void {
  const jeton = lireJeton(req);
  if (!jeton || jeton.role !== 'admin') {
    res.status(401).json({ error: 'Session administrateur requise. Reconnectez-vous.' });
    return;
  }
  next();
}
