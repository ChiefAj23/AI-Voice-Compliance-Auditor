import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  GitCompare,
  History,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  Mic,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { humanize } from '../utils/format';
import Logo from './Logo';
import { Avatar, Badge, IconButton } from './ui';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** The permission that unlocks the page; items without one are for everyone signed in. */
  permission?: string;
}

const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: 'Analyze',
    items: [
      { name: 'New analysis', href: '/', icon: Mic, permission: 'analysis:write' },
      { name: 'Batch processing', href: '/batch', icon: Layers, permission: 'analysis:write' },
    ],
  },
  {
    label: 'Review',
    items: [
      { name: 'History', href: '/history', icon: History, permission: 'analysis:read' },
      { name: 'Statistics', href: '/statistics', icon: BarChart3, permission: 'analysis:read' },
      { name: 'Compare', href: '/compare', icon: GitCompare, permission: 'analysis:read' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { name: 'Compliance rules', href: '/compliance-rules', icon: ShieldCheck, permission: 'compliance:read' },
      { name: 'Scheduled reports', href: '/scheduled-reports', icon: CalendarClock, permission: 'integration:read' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { name: 'Webhooks', href: '/webhooks', icon: Webhook, permission: 'integration:read' },
      { name: 'Notifications', href: '/notifications', icon: Bell, permission: 'integration:read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Teams', href: '/teams', icon: Users, permission: 'user:read' },
      { name: 'Users', href: '/users', icon: UserCog, permission: 'user:read' },
      { name: 'Audit log', href: '/audit-log', icon: ScrollText, permission: 'audit:read' },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const PRODUCT_NAME = 'Voice Compliance Auditor';

function findCurrent(pathname: string) {
  for (const group of navigation) {
    const item = group.items.find((entry) => entry.href === pathname);
    if (item) return { ...item, group: group.label };
  }
  return null;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission } = useAuth();
  const visible = navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || hasPermission(item.permission)) }))
    .filter((group) => group.items.length > 0);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Logo className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight text-fg">Voice Auditor</span>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visible.map((group) => (
          <div key={group.label}>
            <p className="eyebrow px-2.5 pb-1.5">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ name, href, icon: Icon }) => (
                <li key={href}>
                  <NavLink
                    to={href}
                    end
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent-subtle text-accent-fg'
                          : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={clsx(
                            'h-4 w-4 shrink-0',
                            isActive ? 'text-accent-fg' : 'text-fg-subtle group-hover:text-fg-muted',
                          )}
                          aria-hidden="true"
                        />
                        {name}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <p className="text-xs text-fg-subtle">
          Built by <span className="font-medium text-fg-muted">Abhijeet Solanki</span>
        </p>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const displayName = user.full_name || user.username;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <Avatar name={displayName} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-fg md:block">{displayName}</span>
        <ChevronDown className="hidden h-4 w-4 text-fg-subtle md:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 animate-dropdown-in rounded-lg border border-line bg-surface p-1 shadow-overlay"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-fg">{displayName}</p>
            <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            {user.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <Badge key={role}>{humanize(role)}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
          <Link
            to="/change-password"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Change password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const current = findCurrent(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    document.title = current ? `${current.name} · ${PRODUCT_NAME}` : PRODUCT_NAME;
  }, [current?.name]);

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-gray-950/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-slide-in border-r border-line bg-surface shadow-overlay">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
            <IconButton
              icon={X}
              label="Close navigation"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-3"
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <IconButton icon={Menu} label="Open navigation" onClick={() => setSidebarOpen(true)} className="-ml-1.5 lg:hidden" />

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {current && (
              <>
                <span className="hidden text-fg-subtle sm:inline">{current.group}</span>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-fg-faint sm:inline" aria-hidden="true" />
                <span className="truncate font-medium text-fg">{current.name}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon={theme === 'light' ? Moon : Sun}
              label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={toggleTheme}
            />
            <Link to="/notifications" className="btn btn-ghost btn-icon" aria-label="Notifications" title="Notifications">
              <Bell />
            </Link>
            <div className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
