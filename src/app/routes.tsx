import type { ReactNode } from 'react';
import { FinishSummary } from '../features/session/FinishSummary';
import { SessionRunner } from '../features/session/SessionRunner';
import { CatalogEditor } from '../features/settings/routine/CatalogEditor';
import { ScheduleEditor } from '../features/settings/routine/ScheduleEditor';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TodayScreen } from '../features/today/TodayScreen';

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
  { path: '/', label: 'Today', element: <TodayScreen /> },
  { path: '/history', label: 'History', element: <Placeholder title="History" /> },
  { path: '/body', label: 'Body', element: <Placeholder title="Body" /> },
  { path: '/food', label: 'Food', element: <Placeholder title="Food" /> },
  { path: '/settings', label: 'Settings', element: <SettingsScreen /> },
];

/** Screens reached from a tab rather than the nav bar. */
export const SCREENS: { path: string; element: ReactNode }[] = [
  { path: '/session', element: <SessionRunner /> },
  { path: '/summary/:sessionId', element: <FinishSummary /> },
  { path: '/settings/schedule', element: <ScheduleEditor /> },
  { path: '/settings/exercises', element: <CatalogEditor /> },
];
