"""Vérification des PDF fictifs téléchargés par les parcours Chromium."""
from pathlib import Path
import subprocess
import json
import re

out = Path(__file__).resolve().parent
for pdf in out.glob('*.pdf'):
    subprocess.run(['pdftotext', '-layout', str(pdf), str(pdf.with_suffix('.txt'))], check=True)

def read(name):
    return (out / (name + '.txt')).read_text()

def content(name):
    text = re.sub(r'^MediVote — Édité le[^\n]*', '', read(name), flags=re.M)
    return ' '.join(text.split())

results = []
def check(label, condition):
    results.append({'controle': label, 'status': 'OK' if condition else 'ECHEC'})

reference = content('ui-archive')
check('Trois exports identiques hors horodatage d’édition', reference == content('ui-raccourci') == content('ui-table-figee'))
check('Quorum réel : 50 % et deux membres requis', '50 % (2 membres)' in reference)
check('Décompte final : un pour et trois abstentions', bool(re.search(r'Suffrages POUR\s+1 \(25 %\)', reference)) and bool(re.search(r'Abstentions\s+3 \(75 %\)', reference)))
check('Le PDF figé exclut le nouveau nom et le poids de neuf voix', 'Nom changé après la clôture' not in reference and '9 voix' not in reference)
long = content('Proces_Verbal_AUDIT-TEXTE-LONG_2026-09-10')
check('Motion longue : 120 paragraphes conservés', long.count('Paragraphe de contrôle de pagination') == 120)
check('Motion longue : synthèse, dernier membre et signatures conservés', all(s in long for s in ['SYNTHÈSE DES SUFFRAGES', 'Membre fictif D', 'Secrétaire de séance']))
weighted = content('pdf-poids')
check('Pondération : trois voix personnelles et quatre voix pour', '3 voix' in weighted and bool(re.search(r'Suffrages POUR\s+4 \(80 %\)', weighted)))
check('Quorum non atteint et absent non votant', 'QUORUM NON ATTEINT' in weighted and bool(re.search(r'Absent\s+0 voix\s+Non votant', weighted)))
large = ' '.join(subprocess.check_output(['pdftotext', '-raw', str(out / 'pdf-80-membres.pdf'), '-'], text=True).split())
check('Émargement : chacun des 80 membres figure dans le PDF', all(re.search(r'Membre fictif numéro\s+' + str(i) + r'\b', large) for i in range(80)))
pages = read('pv-corrige').split('\f')
check('Aucun en-tête d’émargement isolé', all('N°1' in page for page in pages if 'FEUILLE D’ÉMARGEMENT' in page))
printed = content('impression-finale')
check('Impression : document sans Archives ni notification', 'NOTIFICATION_TEMOIN_A_EXCLURE' not in printed and 'Archives' not in printed and 'Scrutin Clôturé :' not in printed)
check('Heure de Paris explicite dans le PDF et l’impression', 'heure de Paris' in reference and 'heure de Paris' in printed)
check('Aucune affirmation de certification SQLite', all('SQLite' not in content(p.stem) for p in out.glob('*.pdf')))
(out / 'pdf-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
for result in results:
    print(result)
if any(r['status'] != 'OK' for r in results):
    raise SystemExit(1)
