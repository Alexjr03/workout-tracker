import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { BottomNav } from './BottomNav';
import { SCREENS, TABS } from './routes';

function Shell({ overlay }: { overlay?: ReactNode }) {
  // The session runner is full screen so the current exercise and next action always fit.
  const fullScreen = useLocation().pathname === '/session';
  return (
    <>
      <main className={fullScreen ? 'screen screen--full' : 'screen'}>
        <Outlet />
      </main>
      {overlay}
      {!fullScreen && <BottomNav />}
    </>
  );
}

export function AppRoutes({ overlay }: { overlay?: ReactNode }) {
  return (
    <Routes>
      <Route element={<Shell overlay={overlay} />}>
        {[...TABS, ...SCREENS].map((screen) => (
          <Route key={screen.path} path={screen.path} element={screen.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
