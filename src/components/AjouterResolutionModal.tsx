import React, { useEffect, useState } from 'react';
import { FilePlus2, X, Loader2, BookMarked, Lock } from 'lucide-react';
import { MajorityType, MotionTemplate, Seance } from '../types';
import { api } from '../services/api';
import { getMajorityLabel } from '../utils/votingMath';

interface AjouterResolutionModalProps {
  isOpen: boolean;
  seance: Seance | null;
  onClose: () => void;
  onAjouter: (donnees: {
    referenceCode: string;
    title: string;
    motionText: string;
    majorityRequired: MajorityType;
    quorumPct: number;
    isSecret: boolean;
  }) => Promise<void>;
}

/**
 * Ajout d'un point à l'ordre du jour.
 *
 * C'est le geste qu'on fait en séance, souvent dans l'urgence : une résolution
 * s'ajoute, on la vote, on passe à la suivante. Le formulaire ne demande donc
 * que ce qui distingue une résolution d'une autre — son intitulé, son texte, la
 * majorité requise. Tout le reste (date, lieu, collège convoqué, émargement)
 * appartient à la séance et n'est pas à ressaisir.
 */
export const AjouterResolutionModal: React.FC<AjouterResolutionModalProps> = ({
  isOpen,
  seance,
  onClose,
  onAjouter,
}) => {
  const rang = (seance?.resolutions.length || 0) + 1;

  const [referenceCode, setReferenceCode] = useState('');
  const [title, setTitle] = useState('');
  const [motionText, setMotionText] = useState('');
  const [majorityRequired, setMajorityRequired] = useState<MajorityType>('simple');
  const [quorumPct, setQuorumPct] = useState<number>(0);
  const [isSecret, setIsSecret] = useState<boolean>(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MotionTemplate[]>([]);

  // Le formulaire repart à neuf à chaque ouverture : on enchaîne les résolutions.
  useEffect(() => {
    if (!isOpen || !seance) return;
    const derniere = seance.resolutions[seance.resolutions.length - 1];
    setReferenceCode(`${seance.referenceCode}/R${rang}`);
    setTitle('');
    setMotionText('');
    setMajorityRequired(derniere?.majorityRequired || 'simple');
    setQuorumPct(derniere?.quorumPct ?? 0);
    setIsSecret(Boolean(derniere?.isSecret));
    setErreur(null);
    api.getTemplates().then(r => setTemplates(r.templates || [])).catch(() => setTemplates([]));
  }, [isOpen, seance?.id, rang]);

  if (!isOpen || !seance) return null;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErreur('Une résolution doit au moins porter un intitulé.');
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      await onAjouter({
        referenceCode: referenceCode.trim() || `${seance.referenceCode}/R${rang}`,
        title: title.trim(),
        motionText: motionText.trim(),
        majorityRequired,
        quorumPct: Number(quorumPct),
        isSecret,
      });
      onClose();
    } catch (err: any) {
      setErreur(err?.message || "La résolution n'a pas pu être ajoutée.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
      <form
        onSubmit={soumettre}
        className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-xl space-y-5 my-8"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Point n° {rang} de l'ordre du jour
              </h3>
              <p className="text-xs text-slate-500">
                Séance « {seance.title} » — {seance.scheduledDate} à {seance.scheduledTime}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {templates.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5 text-emerald-600" />
              Partir d'un modèle
            </span>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTitle(t.title);
                    setMotionText(t.motionText);
                    setMajorityRequired(t.majorityRequired);
                    setQuorumPct(t.quorumPct ?? 0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-1 space-y-1">
            <span className="text-xs font-semibold text-slate-600">Référence</span>
            <input
              value={referenceCode}
              onChange={e => setReferenceCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
            />
          </label>
          <label className="sm:col-span-2 space-y-1">
            <span className="text-xs font-semibold text-slate-600">Intitulé de la résolution</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              placeholder="Approbation des comptes de l'exercice"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Texte soumis au vote</span>
          <textarea
            value={motionText}
            onChange={e => setMotionText(e.target.value)}
            rows={4}
            placeholder="Le conseil d'administration, après en avoir délibéré, décide…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Règle de majorité</span>
            <select
              value={majorityRequired}
              onChange={e => setMajorityRequired(e.target.value as MajorityType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 outline-hidden"
            >
              {(['simple', 'absolute', 'two_thirds', 'unanimous'] as MajorityType[]).map(m => (
                <option key={m} value={m}>{getMajorityLabel(m)}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">Quorum requis</span>
            <select
              value={quorumPct}
              onChange={e => setQuorumPct(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 outline-hidden"
            >
              <option value={0}>Pas de quorum minimum</option>
              <option value={33}>Un tiers des convoqués</option>
              <option value={50}>La moitié des convoqués</option>
              <option value={66}>Deux tiers des convoqués</option>
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={e => setIsSecret(e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <span className="text-xs text-slate-700">
            <strong className="flex items-center gap-1.5 text-slate-900">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Scrutin secret
            </strong>
            Le sens de chaque bulletin reste masqué — à l'écran comme au journal — jusqu'à la clôture.
          </span>
        </label>

        {erreur && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {erreur}
          </p>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">
          Le point s'ajoute à l'ordre du jour et s'affiche aussitôt sur la table, <strong>scrutin fermé</strong> :
          c'est le président qui l'ouvre. L'émargement de la séance est repris tel quel, et les
          membres votent depuis le QR code qu'ils ont déjà scanné.
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={enregistrement}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
            <span>Ajouter à l'ordre du jour</span>
          </button>
        </div>
      </form>
    </div>
  );
};
