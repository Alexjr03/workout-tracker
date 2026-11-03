import type { ReactNode } from 'react';

export interface Tab {
  path: string;
  label: string;
  element: ReactNode;
}

// Placeholder screens; each feature task replaces its element.
function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export const TABS: Tab[] = [
  { path: '/', label: 'Today', element: <Placeholder title="Today" /> },
  { path: '/history', label: 'History', element: <Placeholder title="History" /> },
  { path: '/body', label: 'Body', element: <Placeholder title="Body" /> },
  { path: '/food', label: 'Food', element: <Placeholder title="Food" /> },
  { path: '/settings', label: 'Settings', element: <Placeholder title="Settings" /> },
];
