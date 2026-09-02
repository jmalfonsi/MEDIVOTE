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

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6 && !verification) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 6) void soumettreCode(nextPin);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void soumettreCode(pin.trim());
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
            Entrez le code administrateur pour ouvrir la table de vote.
          </p>
          <p className="text-[0.6875rem] text-slate-400 mt-1.5">
            Ce poste restera reconnu sept jours : le code ne vous sera pas redemandé.
          </p>
        </div>

        {/* PIN boxes */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-9 h-11 rounded-xl border flex items-center justify-center text-base font-bold font-mono transition-all ${
                  isFilled
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                } ${error ? 'border-rose-400 bg-rose-50 text-rose-800' : ''}`}
              >
                {isFilled ? '•' : ''}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === 'C') {
                  setPin('');
                  setError(null);
                } else if (k === '⌫') {
                  handleBackspace();
                } else {
                  handleDigitClick(k);
                }
              }}
              className={`h-11 rounded-xl font-bold text-sm transition flex items-center justify-center ${
                k === 'C' || k === '⌫'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-white hover:bg-emerald-50 border border-slate-200 text-slate-800 hover:border-emerald-300 shadow-2xs'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={pin.length !== 6 || verification}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition shadow-xs"
          >
            {verification ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>

      </div>
    </div>
  );
};
