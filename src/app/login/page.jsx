'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';
import { ROLE } from '@/utils/constants';

/**
 * Login page component
 * Renders a simple login form with username input, role selection (Officer/Consultant),
 * and login button. Redirects to the dashboard (home page) on successful authentication.
 *
 * Layout:
 * - Centered card with brand logo, username field, role dropdown, and submit button
 * - Error message display for failed login attempts
 * - Loading state while authentication is in progress
 * - Redirects authenticated users to the home page
 *
 * @returns {React.ReactElement}
 */
export default function LoginPage() {
  const { currentUser, isAuthenticated, isLoading, login } = useAuth();

  const [username, setUsername] = useState('');
  const [role, setRole] = useState(ROLE.ADMIN);
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  /**
   * Redirects to home page if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading]);

  /**
   * Handles login form submission
   * Validates input, calls the auth login method, and redirects on success
   *
   * @param {React.FormEvent} event
   */
  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (username.trim().length === 0 || loginLoading) {
        return;
      }

      setLoginLoading(true);
      setLoginError(null);

      try {
        await login(username.trim(), role);
        window.location.href = '/';
      } catch (err) {
        setLoginError(err.message || 'Login failed. Please try again.');
      } finally {
        setLoginLoading(false);
      }
    },
    [username, role, loginLoading, login]
  );

  // Auth restoring state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LoadingSpinner
          size="xl"
          color="brand"
          label="Loading Social DM Copilot..."
          showLabel
        />
      </div>
    );
  }

  // Already authenticated — show loading while redirect happens
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LoadingSpinner
          size="xl"
          color="brand"
          label="Redirecting..."
          showLabel
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-card p-8 space-y-6">
          {/* Brand header */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 text-white font-bold text-lg"
              aria-hidden="true"
            >
              S
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                Social DM Copilot
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Sign in to manage your inbox
              </p>
            </div>
          </div>

          {/* Error message */}
          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{loginError}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="text-sm font-medium text-neutral-600"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                disabled={loginLoading}
                className="input w-full"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-role"
                className="text-sm font-medium text-neutral-600"
              >
                Role
              </label>
              <select
                id="login-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loginLoading}
                className="input w-full"
              >
                <option value={ROLE.ADMIN}>Officer</option>
                <option value={ROLE.AGENT}>Consultant</option>
                <option value={ROLE.VIEWER}>Viewer</option>
              </select>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              fullWidth
              loading={loginLoading}
              disabled={username.trim().length === 0}
              loadingText="Signing in..."
            >
              Sign In
            </Button>
          </form>

          <p className="text-xs text-neutral-400 text-center">
            Stockland Real Estate — Pilot Environment
          </p>
        </div>
      </div>
    </div>
  );
}