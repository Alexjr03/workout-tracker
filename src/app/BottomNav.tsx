import { NavLink } from 'react-router';
import { TABS } from './routes';

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ path, label, icon: Icon }) => (
        <NavLink key={path} to={path} end={path === '/'}>
          <Icon size={22} stroke={2} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
