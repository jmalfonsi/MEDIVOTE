import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

/*
 * Deux applications, une seule page servie. L'adresse /vote/<jeton> ouvre le
 * bulletin d'un membre sur son téléphone : elle ne charge ni l'état de séance,
 * ni le pilotage, ni la moindre demande de code administrateur.
 *
 * Les deux sont chargées à la demande : un téléphone en salle, souvent sur un
 * réseau médiocre, n'a pas à télécharger l'application d'administration ni le
 * générateur de procès-verbal pour appuyer sur trois boutons.
 */
const lienDeVote = window.location.pathname.match(/^\/vote\/([A-Za-z0-9_-]+)\/?$/);

const App = lazy(() => import('./App'));
const PageVoteMobile = lazy(() =>
  import('./components/PageVoteMobile').then(m => ({default: m.PageVoteMobile})),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {lienDeVote ? <PageVoteMobile jeton={lienDeVote[1]} /> : <App />}
    </Suspense>
  </StrictMode>,
);
