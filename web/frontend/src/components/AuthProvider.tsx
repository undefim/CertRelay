import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    // Never show a previous session's cached admin data after signing in again.
    void queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'auth-status' });
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth-status' });
    navigate('/login', { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, [logout]);

  const login = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    navigate('/', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
