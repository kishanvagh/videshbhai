import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jewel_token');
    const cachedUser = localStorage.getItem('jewel_user');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // ignore parse error
      }
    }

    if (token) {
      getMe()
        .then((res) => {
          const userData = res.data.data || res.data.user || res.data;
          setUser(userData);
          localStorage.setItem('jewel_user', JSON.stringify(userData));
        })
        .catch(() => {
          localStorage.removeItem('jewel_token');
          localStorage.removeItem('jewel_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginUser = (token, userData) => {
    localStorage.setItem('jewel_token', token);
    if (userData) {
      localStorage.setItem('jewel_user', JSON.stringify(userData));
    }
    setUser(userData);
  };

  const logoutUser = () => {
    localStorage.removeItem('jewel_token');
    localStorage.removeItem('jewel_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('jewel_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
