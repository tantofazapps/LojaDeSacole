import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import AdminDashboard from './pages/AdminDashboard';
import PublicStore from './pages/PublicStore';
import Login from './pages/Login';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/admin" /> : <Login />} />
          <Route path="/admin/*" element={user ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/loja/:storeId" element={<PublicStore />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
