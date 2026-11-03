import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useTheme from '../hooks/useTheme.js';
import { Icon } from '../components/Icons.jsx';
import { confirmAction } from '../components/ui.jsx';
import { ROLE_LABEL } from '../utils/format.js';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: 'dashboard', end: true },
  { to: '/vehicles', label: 'Véhicules', icon: 'car' },
  { to: '/reservations', label: 'Réservations', icon: 'calendar' },
  { to: '/invoices', label: 'Facturation', icon: 'receipt', roles: ['admin', 'manager', 'user'] },
  { to: '/drivers', label: 'Conducteurs', icon: 'user', roles: ['admin', 'manager'] },
  { to: '/maintenance', label: 'Entretiens', icon: 'wrench', roles: ['admin', 'manager'] },
  { to: '/users', label: 'Utilisateurs', icon: 'shield', roles: ['admin'] },
  { to: '/settings', label: 'Paramètres', icon: 'settings', roles: ['admin'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    const ok = await confirmAction('Voulez-vous vraiment vous déconnecter ?', {
      title: 'Se déconnecter', confirmLabel: 'Se déconnecter', cancelLabel: 'Rester connecté', icon: 'logout',
    });
    if (!ok) return;
    await logout();
    navigate('/login');
  };

  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Icon name="car" size={20} /></span>
          <span>Parc<strong>Auto</strong></span>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n, i) => (
            <NavLink key={n.to} to={n.to} end={n.end} style={{ '--i': i }}>
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Gestion du parc automobile</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="icon-btn theme-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
          <NavLink to="/profile" className="user-chip">
            <span className="avatar">{initials}</span>
            <span className="user-meta">
              <strong>{user.first_name} {user.last_name}</strong>
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
          </NavLink>
          <button type="button" className="btn btn-ghost btn-icon-text" onClick={onLogout}>
            <Icon name="logout" size={16} />
            <span className="hide-sm">Déconnexion</span>
          </button>
        </header>
        {/* La clé relance l'animation d'entrée à chaque changement de page. */}
        <main className="content" key={location.pathname}><Outlet /></main>
      </div>
    </div>
  );
}
