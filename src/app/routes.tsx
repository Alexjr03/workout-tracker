import type { ReactNode } from 'react';
import { BodyScreen } from '../features/body/BodyScreen';
import { FoodScreen } from '../features/food/FoodScreen';
import { ExerciseProgress } from '../features/history/ExerciseProgress';
import { HistoryList } from '../features/history/HistoryList';
import { SessionDetailScreen } from '../features/history/SessionDetailScreen';
import { FinishSummary } from '../features/session/FinishSummary';
import { SessionRunner } from '../features/session/SessionRunner';
import { CatalogEditor } from '../features/settings/routine/CatalogEditor';
import { ScheduleEditor } from '../features/settings/routine/ScheduleEditor';
import { TemplateEditor } from '../features/settings/routine/TemplateEditor';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TodayScreen } from '../features/today/TodayScreen';

export interface Tab {
  path: string;
  label: string;
  element: ReactNode;
}

export const TABS: Tab[] = [
  { path: '/', label: 'Today', element: <TodayScreen /> },
  { path: '/history', label: 'History', element: <HistoryList /> },
  { path: '/body', label: 'Body', element: <BodyScreen /> },
  { path: '/food', label: 'Food', element: <FoodScreen /> },
  { path: '/settings', label: 'Settings', element: <SettingsScreen /> },
];

/** Screens reached from a tab rather than the nav bar. */
export const SCREENS: { path: string; element: ReactNode }[] = [
  { path: '/session', element: <SessionRunner /> },
  { path: '/summary/:sessionId', element: <FinishSummary /> },
  { path: '/history/session/:sessionId', element: <SessionDetailScreen /> },
  { path: '/history/exercises', element: <ExerciseProgress /> },
  { path: '/settings/schedule', element: <ScheduleEditor /> },
  { path: '/settings/exercises', element: <CatalogEditor /> },
  { path: '/settings/sessions/:templateId', element: <TemplateEditor /> },
];
