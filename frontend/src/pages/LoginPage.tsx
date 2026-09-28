import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Field, Spinner } from '../components/ui';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { message?: string } | null)?.message;
  const [allowRegister, setAllowRegister] = useState(false);

  useEffect(() => {
    authApi
      .getConfig()
      .then((config) => setAllowRegister(config.allow_self_registration))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const signedIn = await login(username, password);
      navigate(signedIn.must_change_password ? '/change-password' : '/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back. Sign in to review calls and compliance results."
      footer={
        allowRegister ? (
          <>
            Don&apos;t have an account?{' '}
            <Link to="/register" className="link">
              Create one
            </Link>
          </>
        ) : (
          <>Accounts are created by an administrator.</>
        )
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {notice && !error && (
          <div className="callout callout-success" role="status">
            <CheckCircle2 />
            <p>{notice}</p>
          </div>
        )}
        {error && (
          <div className="callout callout-danger" role="alert">
            <AlertCircle />
            <p>{error}</p>
          </div>
        )}

        <Field label="Username" htmlFor="username">
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="input pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-fg-faint transition-colors hover:text-fg-muted"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading && <Spinner />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {import.meta.env.DEV && (
          <p className="text-center text-xs text-fg-subtle">
            Development build · sign in as <span className="code-chip">admin</span> with{' '}
            <span className="code-chip">ADMIN_PASSWORD</span>, or the password the API printed on
            its first start
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
