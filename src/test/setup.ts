import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy*/waitFor default to 1 s, too short for live DB queries when the whole suite runs
// in parallel with coverage.
configure({ asyncUtilTimeout: 3000 });

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);
