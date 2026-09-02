import QRCode from 'qrcode';
import type { Request } from 'express';

/**
 * Fabrication des QR codes de vote.
 *
 * Le QR est produit en SVG puis encodé en data:URI : il reste net quelle que
 * soit la taille — sur la tuile d'un membre comme en plein écran sur l'écran de
 * la salle — et le navigateur n'a aucune bibliothèque à charger.
 */

/**
 * Adresse publique de l'application. Elle doit être celle que les téléphones
 * savent joindre : en production, le nom de domaine du reverse proxy, pas
 * l'adresse interne du service. MEDIVOTE_URL_PUBLIQUE fait foi ; à défaut on
 * reconstitue l'origine à partir des en-têtes du proxy.
 */
export function originePublique(req: Request): string {
  const configuree = process.env.MEDIVOTE_URL_PUBLIQUE;
  if (configuree) return configuree.replace(/\/+$/, '');

  const protocole = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const hote = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${protocole}://${hote}`;
}

export function lienDeVote(req: Request, jeton: string): string {
  return `${originePublique(req)}/vote/${jeton}`;
}

/** QR code en data:URI SVG, prêt à poser dans un <img src="...">. */
export async function qrDataUri(contenu: string): Promise<string> {
  const svg = await QRCode.toString(contenu, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
