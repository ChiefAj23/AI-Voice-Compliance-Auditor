import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mic, Shield, BarChart3, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Left side - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white px-12">
          {/* Logo/Icon */}
          <div className="mb-8">
            <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Mic className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-4 text-center">
            🎙️ Voice Audit System
          </h1>
          <p className="text-xl text-white text-opacity-90 mb-8 text-center">
            AI-Powered Compliance Monitoring
          </p>

          {/* Features */}
          <div className="space-y-4 w-full max-w-md">
            <div className="flex items-start space-x-3 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <Shield className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Compliance Monitoring</h3>
                <p className="text-sm text-white text-opacity-80">Real-time compliance scoring and alerts</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <BarChart3 className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Advanced Analytics</h3>
                <p className="text-sm text-white text-opacity-80">Sentiment analysis and conversation insights</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4">
              <Sparkles className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">AI-Powered</h3>
                <p className="text-sm text-white text-opacity-80">Multi-language support with intelligent detection</p>
              </div>
            </div>
          </div>

          {/* Developer Credit */}
          <div className="mt-12 pt-8 border-t border-white border-opacity-20 w-full max-w-md text-center">
            <p className="text-sm text-white text-opacity-80 mb-1">
              Developed with <span className="text-red-300">❤️</span> by
            </p>
            <p className="text-lg font-semibold text-white">
              Abhijeet Solanki
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white bg-opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white bg-opacity-5 rounded-full -ml-48 -mb-48"></div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
        <div>
          {/* Logo for mobile */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎙️ Voice Audit</h1>
          </div>

          <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account or{' '}
            <Link
              to="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Default admin: <span className="font-mono">admin / admin123</span></p>
          </div>
        </form>

        {/* Developer Credit - Mobile */}
        <div className="lg:hidden mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Developed with <span className="text-red-500">❤️</span> by
          </p>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            Abhijeet Solanki
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

