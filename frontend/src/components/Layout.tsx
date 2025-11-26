import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Mic,
  History,
  BarChart3,
  GitCompare,
  Settings,
  Upload,
  Moon,
  Sun,
  Shield,
  Clock,
  Webhook,
  Bell,
  Users,
  UserCircle,
  LogOut
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'New Analysis', href: '/', icon: Mic },
  { name: 'Batch Processing', href: '/batch', icon: Upload },
  { name: 'History', href: '/history', icon: History },
  { name: 'Statistics', href: '/statistics', icon: BarChart3 },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'Compliance Rules', href: '/compliance-rules', icon: Shield },
  { name: 'Scheduled Reports', href: '/scheduled-reports', icon: Clock },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Users', href: '/users', icon: UserCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg z-10 transition-colors duration-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 bg-primary-600 dark:bg-primary-700">
            <h1 className="text-2xl font-bold text-white">🎙️ Voice Auditor</h1>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-white" />
              ) : (
                <Sun className="h-5 w-5 text-white" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          {user && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-600 dark:bg-primary-700 flex items-center justify-center text-white font-semibold">
                    {user.full_name?.[0] || user.username[0].toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                  {user.roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.roles.slice(0, 2).map((role) => (
                        <span
                          key={role}
                          className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          )}

          {/* Developer Credit */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Developed with <span className="text-red-500">❤️</span> by
              </p>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Abhijeet Solanki
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen flex flex-col">
        <div className="flex-1 p-8">
          {children}
        </div>

        {/* Footer with Developer Credit */}
        <footer className="ml-64 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-4 px-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Voice Audit System
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Developed with</span>
              <span className="text-red-500">❤️</span>
              <span className="text-gray-500 dark:text-gray-400">by</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Abhijeet Solanki</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

