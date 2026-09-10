import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, ShieldCheck, AlertCircle, Clock, Users } from 'lucide-react';

/**
 * Page de vote d'un membre, ouverte depuis le QR code affiché sur l'écran de la
 * salle. C'est le seul écran de MediVote accessible sans code administrateur :
 * l'autorisation tient au lien lui-même. Le membre n'y voit que ce qui le
 * concerne — la séance, le texte soumis au vote, ses pouvoirs, trois boutons —
 * et rien du pilotage ni du décompte en cours.
 */

type Choix = 'for' | 'against' | 'abstain';

interface Contexte {
  seance: {
    referenceCode: string;
    title: string;
    motionText: string;
    scheduledDate: string;
    scheduledTime: string;
    location: string;
    status: 'draft' | 'open' | 'closed';
    isSecret: boolean;
  };
  /** Résolution en cours. Son identifiant change quand la séance passe au point suivant. */
  resolution: { id: string; ordre: number; total: number; referenceCode: string; title: string };
  seanceClose: boolean;
  votant: { name: string; title: string; seatNumber: number };
  presence: string;
  aVote: boolean;
  choix: string | null;
  pouvoirs: { name: string; title: string }[];
  expireLe: string;
}

const LIBELLES: Record<Choix, string> = {
  for: 'POUR',
  against: 'CONTRE',
  abstain: 'ABSTENTION',
};

function dateEnToutesLettres(iso: string, heure: string): string {
  const d = new Date(`${iso}T${heure || '00:00'}:00`);
  if (Number.isNaN(d.getTime())) return `${iso} à ${heure}`;
  const jour = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} à ${heure}`;
}

export const PageVoteMobile: React.FC<{ jeton: string }> = ({ jeton }) => {
  const [contexte, setContexte] = useState<Contexte | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurLien, setErreurLien] = useState<string | null>(null);
  const [erreurVote, setErreurVote] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<Choix | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmation, setConfirmation] = useState<{ choix: Choix; pouvoirs: number; secret: boolean } | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/scrutin/${encodeURIComponent(jeton)}`);
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setErreurLien(detail?.error || "Ce lien de vote n'est plus valable.");
        setContexte(null);
        return;
      }
      setErreurLien(null);
      const recu: Contexte = await res.json();
      setContexte(precedent => {
        /*
         * Le lien vaut pour la séance entière. Quand elle passe au point suivant
         * de l'ordre du jour, la page suit d'elle-même : on efface la
         * confirmation du bulletin précédent, et le membre a de nouveau trois
         * boutons devant lui — sans avoir à rescanner quoi que ce soit.
         */
        if (precedent && precedent.resolution?.id !== recu.resolution?.id) {
          setConfirmation(null);
          setErreurVote(null);
          setAConfirmer(null);
        }
        return recu;
      });
    } catch (_) {
      setErreurLien('Connexion impossible. Vérifiez le réseau de la salle.');
    } finally {
      setChargement(false);
    }
  }, [jeton]);

  useEffect(() => {
    charger();
  }, [charger]);

  /*
   * Le téléphone n'a pas de flux temps réel : il interroge le serveur toutes les
   * cinq secondes. On continue même après un bulletin déposé — une séance porte
   * plusieurs résolutions, et c'est ainsi que la page bascule sur la suivante.
   * Seule la clôture de la séance, ou un lien mort, arrête la surveillance.
   */
  useEffect(() => {
    if (erreurLien || contexte?.seanceClose) return;
    const minuterie = setInterval(charger, 5000);
    return () => clearInterval(minuterie);
  }, [charger, erreurLien, contexte?.seanceClose]);

  const envoyer = async (choix: Choix) => {
    setEnvoi(true);
    setErreurVote(null);
    try {
      const res = await fetch(`/api/scrutin/${encodeURIComponent(jeton)}/bulletin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: choix }),
      });
      const donnees = await res.json().catch(() => null);
      if (!res.ok) {
        setErreurVote(donnees?.error || "Le suffrage n'a pas pu être enregistré.");
        setAConfirmer(null);
        charger();
        return;
      }
      setConfirmation({ choix, pouvoirs: donnees?.pouvoirs || 0, secret: Boolean(donnees?.secret) });
    } catch (_) {
      setErreurVote('Connexion perdue. Réessayez, votre suffrage n\'a pas été enregistré.');
    } finally {
      setEnvoi(false);
      setAConfirmer(null);
    }
  };

  const Entete = (
    <header className="flex flex-col items-center gap-3 pt-8 pb-6">
      <img src="/logo-ssti03.png" alt="SSTI 03" className="h-16 w-auto" />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
        Vote en séance
      </p>
    </header>
  );

  const Cadre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-[#F4F7F5] px-4 pb-12">
      <div className="mx-auto w-full max-w-md">
        {Entete}
        {children}
      </div>
    </div>
  );

  if (chargement) {
    return (
      <Cadre>
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="text-sm">Ouverture de votre bulletin…</p>
        </div>
      </Cadre>
    );
  }

  if (erreurLien || !contexte) {
    return (
      <Cadre>
        <div className="rounded-3xl border border-rose-200 bg-white p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <h1 className="text-lg font-bold text-slate-900">Lien de vote inutilisable</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{erreurLien}</p>
          <p className="mt-4 text-xs text-slate-500">
            Rapprochez-vous de l'administrateur de séance : il peut réafficher votre QR code
            sur l'écran de la salle.
          </p>
        </div>
      </Cadre>
    );
  }

  const { seance, votant, pouvoirs } = contexte;
  const voix = 1 + pouvoirs.length;

  // Bulletin déposé : à l'instant, ou lors d'un passage précédent sur cette page.
  const dejaVote = Boolean(confirmation) || contexte.aVote;

  return (
    <Cadre>
      <div className="space-y-4">
        {/* Séance : quoi, quand, où. */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
              {seance.referenceCode}
            </span>
            {contexte.resolution && contexte.resolution.total > 1 && (
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Point {contexte.resolution.ordre} sur {contexte.resolution.total}
              </span>
            )}
            {seance.isSecret && (
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Scrutin secret
              </span>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold leading-snug text-slate-900">{seance.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600">
            <Clock className="h-4 w-4 shrink-0 text-emerald-700" />
            {dateEnToutesLettres(seance.scheduledDate, seance.scheduledTime)}
          </p>
          {seance.location && (
            <p className="mt-1 text-sm text-slate-500">{seance.location}</p>
          )}
          {seance.motionText && (
            <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
              {seance.motionText}
            </p>
          )}
        </section>

        {/* Identité du votant et poids de sa voix. */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Bulletin de
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {votant.title} {votant.name}
          </p>
          {pouvoirs.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <span>
                Vous portez le pouvoir de{' '}
                <strong>{pouvoirs.map(p => `${p.title} ${p.name}`).join(' et ')}</strong>.
                Votre vote comptera pour <strong>{voix} voix</strong>.
              </span>
            </div>
          )}
        </section>

        {/* Le bulletin proprement dit. */}
        {dejaVote ? (
          <section className="rounded-3xl border border-emerald-300 bg-white p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Votre suffrage est enregistré</h2>
            {confirmation && !confirmation.secret && (
              <p className="mt-2 text-sm text-slate-600">
                Vous avez voté <strong>{LIBELLES[confirmation.choix]}</strong>
                {confirmation.pouvoirs > 0 && ` pour ${confirmation.pouvoirs + 1} voix`}.
              </p>
            )}
            {!confirmation && contexte.choix && !seance.isSecret && (
              <p className="mt-2 text-sm text-slate-600">
                Vous avez voté <strong>{LIBELLES[contexte.choix as Choix] || contexte.choix}</strong>.
              </p>
            )}
            {seance.isSecret && (
              <p className="mt-2 text-sm text-slate-600">
                Le sens de votre bulletin reste masqué jusqu'à la clôture.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              {contexte.seanceClose
                ? 'La séance est close. Vous pouvez ranger votre téléphone.'
                : "On ne vote qu'une fois sur une résolution. Gardez cette page ouverte : si la séance passe à un autre point de l'ordre du jour, votre bulletin s'y affichera automatiquement."}
            </p>
          </section>
        ) : seance.status !== 'open' ? (
          <section className="rounded-3xl border border-amber-300 bg-white p-6 text-center">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Le scrutin n'est pas encore ouvert</h2>
            <p className="mt-2 text-sm text-slate-600">
              Gardez cette page ouverte : les boutons apparaîtront dès que le président
              ouvrira le scrutin.
            </p>
          </section>
        ) : contexte.presence === 'absent' || contexte.presence === 'excused' ? (
          <section className="rounded-3xl border border-rose-200 bg-white p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-7 w-7 text-rose-500" />
            <h2 className="text-base font-bold text-slate-900">Vous n'êtes pas émargé présent</h2>
            <p className="mt-2 text-sm text-slate-600">
              Signalez-vous à l'administrateur de séance : dès qu'il vous notera présent,
              vous pourrez voter depuis cette page.
            </p>
          </section>
        ) : contexte.presence === 'proxy' ? (
          <section className="rounded-3xl border border-amber-300 bg-white p-6 text-center">
            <Users className="mx-auto mb-3 h-7 w-7 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Vous avez donné pouvoir</h2>
            <p className="mt-2 text-sm text-slate-600">
              Un autre membre vote en votre nom : vous n'avez pas de bulletin à déposer.
            </p>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Exprimez votre suffrage
            </p>

            {erreurVote && (
              <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {erreurVote}
              </p>
            )}

            {aConfirmer ? (
              /* Un bulletin ne se retire pas : on demande confirmation avant de l'enregistrer. */
              <div className="space-y-3">
                <p className="text-center text-sm text-slate-700">
                  Confirmez-vous votre vote{' '}
                  <strong className="text-slate-900">{LIBELLES[aConfirmer]}</strong>
                  {voix > 1 && ` (${voix} voix)`} ?
                </p>
                <button
                  disabled={envoi}
                  onClick={() => envoyer(aConfirmer)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white disabled:opacity-60"
                >
                  {envoi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  Confirmer — c'est définitif
                </button>
                <button
                  disabled={envoi}
                  onClick={() => setAConfirmer(null)}
                  className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600"
                >
                  Revenir en arrière
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setAConfirmer('for')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 py-5 text-lg font-bold text-emerald-800 active:bg-emerald-100"
                >
                  <Check className="h-6 w-6" />
                  POUR
                </button>
                <button
                  onClick={() => setAConfirmer('against')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 py-5 text-lg font-bold text-rose-800 active:bg-rose-100"
                >
                  <X className="h-6 w-6" />
                  CONTRE
                </button>
                <button
                  onClick={() => setAConfirmer('abstain')}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-100 py-5 text-lg font-bold text-slate-700 active:bg-slate-200"
                >
                  ABSTENTION
                </button>
              </div>
            )}
          </section>
        )}

        <p className="px-2 pt-2 text-center text-xs leading-relaxed text-slate-400">
          Lien personnel, valable pour cette séance uniquement, et pour un seul bulletin par
          résolution. Ne le transmettez pas.
        </p>
      </div>
    </Cadre>
  );
};
