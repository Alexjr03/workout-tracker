import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { BottomNav } from './BottomNav';
import { SCREENS, TABS } from './routes';

function Shell({ overlay }: { overlay?: ReactNode }) {
  return (
    <>
      <main className="screen">
        <Outlet />
      </main>
      {overlay}
      <BottomNav />
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
