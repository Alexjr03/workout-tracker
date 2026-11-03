import { useLiveQuery } from 'dexie-react-hooks';
import { HashRouter } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from '../db/schema';
import { AppRoutes } from './App';
import { UpdatePrompt } from './UpdatePrompt';

// Hash routing: GitHub Pages has no SPA fallback, so deep links must never reach the server.
export function Root() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  // Never offer a reload mid-workout (and stay quiet until we know).
  const activeCount = useLiveQuery(() => db.activeSession.count());

  return (
    <HashRouter>
      <AppRoutes
        overlay={
          <UpdatePrompt
            needRefresh={needRefresh}
            suppressed={activeCount !== 0}
            onUpdate={() => void updateServiceWorker()}
            onDismiss={() => setNeedRefresh(false)}
          />
        }
      />
    </HashRouter>
  );
}
