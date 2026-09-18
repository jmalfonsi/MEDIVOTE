import { describe, it, expect } from 'vitest';
import { createVoteRateLimiter } from '../voteRateLimit';

describe('cadence des téléphones', () => {
  const invoke = (limit: ReturnType<typeof createVoteRateLimiter>, token: string, method = 'GET') => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json() {}, setHeader() {} };
    limit({ip:'127.0.0.1',params:{jeton:token},method} as any,res as any,()=>{});
    return status;
  };
  it('autorise 28 téléphones derrière la même IP et leur vote après les lectures',()=>{
    const limit=createVoteRateLimiter();
    for(let phone=0;phone<28;phone++) {
      for(let poll=0;poll<12;poll++) expect(invoke(limit,String(phone))).toBe(200);
      expect(invoke(limit,String(phone),'POST')).toBe(200);
    }
  });
  it('limite les dépôts répétés par lien et rétablit le quota après une minute',()=>{
    let now=0;const limit=createVoteRateLimiter(()=>now);
    for(let n=0;n<20;n++) expect(invoke(limit,'a','POST')).toBe(200);
    expect(invoke(limit,'a','POST')).toBe(429);
    expect(invoke(limit,'a')).toBe(200);expect(invoke(limit,'b','POST')).toBe(200);
    now=60001;expect(invoke(limit,'a','POST')).toBe(200);
  });
});
