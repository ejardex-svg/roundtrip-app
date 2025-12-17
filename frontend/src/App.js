import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ClientDashboard from "./pages/ClientDashboard";
import TransporterDashboard from "./pages/TransporterDashboard";
import RequestDetail from "./pages/RequestDetail";
import Profile from "./pages/Profile";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import AdminDashboard from "./pages/AdminDashboard";
import { Toaster } from "./components/ui/sonner";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            user ? <Navigate to={user.roles.includes('cliente') ? "/cliente" : "/transportista"} /> : <LandingPage onLogin={handleLogin} />
          } />
          <Route path="/cliente" element={
            user && user.roles.includes('cliente') ? <ClientDashboard user={user} token={token} onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/transportista" element={
            user && user.roles.includes('transportista') ? <TransporterDashboard user={user} token={token} onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/request/:id" element={
            user ? <RequestDetail user={user} token={token} onLogout={handleLogout} /> : <Navigate to="/" />
          } />
          <Route path="/profile" element={
            user ? <Profile user={user} token={token} onLogout={handleLogout} onUserUpdate={setUser} /> : <Navigate to="/" />
          } />
          <Route path="/payments/success" element={
            user ? <PaymentSuccess user={user} token={token} /> : <Navigate to="/" />
          } />
          <Route path="/payments/cancel" element={
            user ? <PaymentCancel user={user} /> : <Navigate to="/" />
          } />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
