import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSelectedRole, setHasSelectedRole] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    try {
      // TODO: Implement actual authentication logic
      // For now, we'll simulate a successful login
      setUser({ id: '1', email });
      setIsLoggedIn(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setHasSelectedRole(false);
    setUserRole(null);
    setUser(null);
  };

  const selectRole = (role) => {
    setUserRole(role);
    setHasSelectedRole(true);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        hasSelectedRole,
        userRole,
        user,
        login,
        logout,
        selectRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 