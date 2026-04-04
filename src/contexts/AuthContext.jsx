'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { encrypt, decrypt } from '@/utils/encryption';
import { ROLE, ROLE_LIST, STORAGE_KEY } from '@/utils/constants';
import { sanitizeInput } from '@/utils/validators';

/**
 * Authentication Context
 * Manages simple login state with role-based access (Officer, Consultant)
 * Stores encrypted credentials in localStorage
 * Implements AuthContext from LLD (SCRUM-6536)
 *
 * Provides:
 * - login(username, role): Authenticates a user with a given role
 * - logout(): Clears authentication state
 * - currentUser: Current authenticated user object
 * - role: Current user's role
 * - isAuthenticated: Whether a user is currently authenticated
 * - hasRole(requiredRole): Checks if the current user has a specific role
 */

/**
 * localStorage key for persisted auth state
 */
const AUTH_STORAGE_KEY = STORAGE_KEY.LOCAL_AUTH_TOKEN;

/**
 * Application-specific roles mapped to the ROLE constants
 * Officer maps to admin, Consultant maps to agent
 */
const APP_ROLE = Object.freeze({
  OFFICER: ROLE.ADMIN,
  CONSULTANT: ROLE.AGENT,
});

const APP_ROLE_LABELS = Object.freeze({
  [ROLE.ADMIN]: 'Officer',
  [ROLE.AGENT]: 'Consultant',
  [ROLE.VIEWER]: 'Viewer',
});

/**
 * @typedef {object} AuthUser
 * @property {string} username - User's display name
 * @property {string} role - User's role (from ROLE constants)
 * @property {string} roleLabel - Human-readable role label
 * @property {string} authenticatedAt - ISO timestamp of authentication
 */

/**
 * @typedef {object} AuthContextValue
 * @property {AuthUser|null} currentUser - Current authenticated user
 * @property {string|null} role - Current user's role
 * @property {boolean} isAuthenticated - Whether a user is authenticated
 * @property {boolean} isLoading - Whether auth state is being loaded
 * @property {Function} login - Login function
 * @property {Function} logout - Logout function
 * @property {Function} hasRole - Role check function
 */

const AuthContext = createContext(null);

/**
 * Encrypts and persists auth state to localStorage
 *
 * @param {AuthUser} user - User object to persist
 * @returns {Promise<void>}
 */
async function persistAuthState(user) {
  if (!user) {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // localStorage may be unavailable
    }
    return;
  }

  try {
    const serialized = JSON.stringify(user);
    const encrypted = await encrypt(serialized);
    localStorage.setItem(AUTH_STORAGE_KEY, encrypted);
  } catch {
    console.warn('[AuthContext] Failed to persist auth state to localStorage');
  }
}

/**
 * Loads and decrypts auth state from localStorage
 *
 * @returns {Promise<AuthUser|null>} Restored user object or null
 */
async function loadAuthState() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const decrypted = await decrypt(stored);
    const user = JSON.parse(decrypted);

    // Validate restored user object
    if (
      user &&
      typeof user === 'object' &&
      typeof user.username === 'string' &&
      user.username.trim().length > 0 &&
      typeof user.role === 'string' &&
      ROLE_LIST.includes(user.role)
    ) {
      return user;
    }

    // Invalid stored data — clear it
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  } catch {
    // Decryption or parsing failed — clear stored data
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
    return null;
  }
}

/**
 * Authentication context provider component
 * Manages login state, role-based access, and encrypted credential persistence
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted auth state on mount
  useEffect(() => {
    let mounted = true;

    async function restoreAuth() {
      try {
        const restoredUser = await loadAuthState();
        if (mounted) {
          setCurrentUser(restoredUser);
        }
      } catch {
        console.warn('[AuthContext] Failed to restore auth state');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    restoreAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Authenticates a user with a given role
   * Validates inputs, creates a user object, encrypts and persists to localStorage
   *
   * @param {string} username - User's display name
   * @param {string} role - User's role (must be a valid ROLE constant)
   * @returns {Promise<AuthUser>} Authenticated user object
   * @throws {Error} If username or role is invalid
   */
  const login = useCallback(async (username, role) => {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new Error('Username is required and must be a non-empty string');
    }

    if (!role || typeof role !== 'string') {
      throw new Error('Role is required and must be a string');
    }

    if (!ROLE_LIST.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${ROLE_LIST.join(', ')}`);
    }

    const sanitizedUsername = sanitizeInput(username.trim());

    if (sanitizedUsername.length === 0) {
      throw new Error('Username must contain valid characters');
    }

    if (sanitizedUsername.length > 100) {
      throw new Error('Username must not exceed 100 characters');
    }

    const user = {
      username: sanitizedUsername,
      role,
      roleLabel: APP_ROLE_LABELS[role] || role,
      authenticatedAt: new Date().toISOString(),
    };

    // Persist encrypted auth state
    await persistAuthState(user);

    setCurrentUser(user);

    return user;
  }, []);

  /**
   * Clears authentication state and removes persisted credentials
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    setCurrentUser(null);
    await persistAuthState(null);
  }, []);

  /**
   * Checks if the current user has a specific role
   *
   * @param {string} requiredRole - Role to check against
   * @returns {boolean} True if the current user has the required role
   */
  const hasRole = useCallback(
    (requiredRole) => {
      if (!currentUser || !currentUser.role) return false;
      if (!requiredRole || typeof requiredRole !== 'string') return false;

      // Admin/Officer role has access to everything
      if (currentUser.role === ROLE.ADMIN) return true;

      return currentUser.role === requiredRole;
    },
    [currentUser]
  );

  const isAuthenticated = currentUser !== null;
  const role = currentUser ? currentUser.role : null;

  const contextValue = useMemo(
    () => ({
      currentUser,
      role,
      isAuthenticated,
      isLoading,
      login,
      logout,
      hasRole,
    }),
    [currentUser, role, isAuthenticated, isLoading, login, logout, hasRole]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the authentication context
 * Must be used within an AuthProvider
 *
 * @returns {AuthContextValue} Authentication context value
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Exported role constants and labels for consumers
 */
export { APP_ROLE, APP_ROLE_LABELS };

export default AuthContext;