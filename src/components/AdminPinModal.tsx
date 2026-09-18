import React, { useState } from 'react';
import { Lock, X, AlertCircle, KeyRound } from 'lucide-react';
import { auth } from '../services/api';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** false sur l'écran d'accueil : il n'y a rien derrière, la fermeture n'aurait pas de sens. */
  fermable?: boolean;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  fermable = true,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  if (!isOpen) return null;

  // Le code est vérifié par le serveur : il n'existe pas dans le code du navigateur.
  const soumettreCode = async (code: string) => {
    if (verification) return;
    setVerification(true);
    try {
      await auth.connexionAdmin(code);
      setPin('');
      setError(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setPin('');
      setError(err?.message || 'Code administrateur incorrect.');
    } finally {
      setVerification(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (verification) return;
    const nextPin = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(nextPin);
    setError(null);
    if (nextPin.length === 6) void soumettreCode(nextPin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 space-y-5 text-center relative">
        
        {fermable && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <img
          src="/logo-ssti03.png"
          alt="SSTI 03 — Allier Prévention Santé Entreprises"
          className="w-24 h-24 object-contain mx-auto"
        />

        <div>
          <h3 className="text-base font-bold text-slate-900">Accès administrateur</h3>
          <p className="text-[0.6875rem] font-semibold text-emerald-700 mt-0.5 uppercase tracking-wide">
            Conseil d'Administration · SSTI 03
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Tapez le code administrateur au clavier pour ouvrir la table de vote.
          </p>
          <p className="text-[0.6875rem] text-slate-400 mt-1.5">
            Ce poste restera reconnu sept jours : le code ne vous sera pas redemandé.
          </p>
        </div>

        {/* Le champ couvre les témoins mais reste invisible : aucune touche du
            code n'est affichée, même brièvement par le navigateur. */}
        <label className="relative flex items-center justify-center gap-2 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/30">
          <span className="sr-only">Code administrateur à six chiffres</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={handlePinChange}
            onPaste={e => e.preventDefault()}
            onDrop={e => e.preventDefault()}
            disabled={verification}
            aria-label="Code administrateur à six chiffres"
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          />
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <span
                key={idx}
                aria-hidden="true"
                className={`w-9 h-11 rounded-xl border flex items-center justify-center text-base font-bold font-mono transition-all ${
                  isFilled
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                } ${error ? 'border-rose-400 bg-rose-50 text-rose-800' : ''}`}
              >
                {isFilled ? '•' : ''}
              </span>
            );
          })}
        </label>

        {error && (
          <div className="text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <p className="text-xs font-semibold text-slate-500">
          {verification ? 'Vérification…' : 'Validation automatique après 6 chiffres · collage désactivé'}
        </p>

      </div>
    </div>
  );
};
