import type { Request, Response, NextFunction } from 'express';

/** Les lectures d'un téléphone ne consomment jamais le quota de dépôt d'un autre. */
export function createVoteRateLimiter(now: () => number = Date.now) {
  const windows = new Map<string, {count:number; until:number}>();
  return (req: Request, res: Response, next: NextFunction) => {
    const time = now();
    // Purger les clés expirées et borner la mémoire, même avec des jetons inventés.
    if (windows.size > 10000) for (const [key,w] of windows) if (w.until <= time) windows.delete(key);
    const token = String(req.params.jeton || '').slice(0,128);
    const key = `${req.method}:${token}`;
    const limit = req.method === 'GET' ? 120 : 20;
    const window = windows.get(key);
    if (!window || window.until <= time) {
      if (windows.size >= 20000 && !windows.has(key)) { res.status(429).json({error:'Trop de requêtes. Réessayez dans une minute.'}); return; }
      windows.set(key,{count:1,until:time+60000}); next(); return;
    }
    if (++window.count > limit) {
      res.setHeader('Retry-After',Math.ceil((window.until-time)/1000));
      res.status(429).json({error:'Trop de requêtes pour ce lien. Patientez une minute.'}); return;
    }
    next();
  };
}
