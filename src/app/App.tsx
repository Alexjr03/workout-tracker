import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { BottomNav } from './BottomNav';
import { TABS } from './routes';

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
        {TABS.map((tab) => (
          <Route key={tab.path} path={tab.path} element={tab.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
