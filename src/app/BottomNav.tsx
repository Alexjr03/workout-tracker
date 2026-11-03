import { NavLink } from 'react-router';
import { TABS } from './routes';

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.path} to={tab.path} end>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
