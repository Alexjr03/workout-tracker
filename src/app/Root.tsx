import { HashRouter } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppRoutes } from './App';
import { UpdatePrompt } from './UpdatePrompt';

// Hash routing: GitHub Pages has no SPA fallback, so deep links must never reach the server.
export function Root() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <HashRouter>
      <AppRoutes
        overlay={
          <UpdatePrompt
            needRefresh={needRefresh}
            suppressed={false}
            onUpdate={() => void updateServiceWorker()}
            onDismiss={() => setNeedRefresh(false)}
          />
        }
      />
    </HashRouter>
  );
}
