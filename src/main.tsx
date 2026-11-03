import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './app/Root';
import './app/theme.css';
import { db } from './db/schema';
import { ensureSeeded } from './db/seed';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

function render() {
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

// Seed before the first render so every screen can rely on settings and routine rows.
ensureSeeded(db).then(render, (error: unknown) => {
  console.error('Seeding failed', error);
  render();
});
