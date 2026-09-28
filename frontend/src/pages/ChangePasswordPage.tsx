import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import AuthLayout from '../components/AuthLayout';
import { Field, Spinner } from '../components/ui';
import { errorDetail } from '../utils/errors';

/**
 * Set a new password. Shown on the first sign-in of an account created by an administrator (the
 * API refuses everything else until it is done) and reachable from the user menu at any time.
 */
export default function ChangePasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [minLength, setMinLength] = useState(12);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .getConfig()
      .then((config) => setMinLength(config.min_password_length))
      .catch(() => {});
  }, []);

  if (!authApi.isAuthenticated()) return <Navigate to="/login" replace />;

  const required = !!user?.must_change_password;
  const tooShort = next.length > 0 && next.length < minLength;
  const mismatch = confirm.length > 0 && confirm !== next;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorDetail(err) || 'The password could not be changed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={required ? 'Set a new password' : 'Change your password'}
      description={
        required
          ? `Welcome${user?.full_name ? `, ${user.full_name}` : ''}. Your account was created with a temporary password. Choose your own before continuing.`
          : 'Choose a new password for your account.'
      }
      footer={
        <button type="button" className="link" onClick={() => { logout(); navigate('/login'); }}>
          Sign out instead
        </button>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && (
          <div className="callout callout-danger" role="alert">
            <AlertCircle />
            <p>{error}</p>
          </div>
        )}

        <Field label={required ? 'Temporary password' : 'Current password'} htmlFor="current-password">
          <input
            id="current-password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="new-password"
          help={`At least ${minLength} characters. A sentence you will remember works well.`}
          error={tooShort ? `Needs ${minLength - next.length} more character${minLength - next.length === 1 ? '' : 's'}` : undefined}
        >
          <div className="relative">
            <input
              id="new-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={minLength}
              className="input pr-10"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-fg-faint transition-colors hover:text-fg-muted"
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-password" error={mismatch ? 'Does not match the new password' : undefined}>
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <button type="submit" disabled={loading || tooShort || mismatch} className="btn btn-primary btn-lg w-full">
          {loading ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
          {loading ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
