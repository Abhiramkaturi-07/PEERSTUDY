import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, LogOut, User as UserIcon, LayoutDashboard, MessageSquare, BarChart3, NotebookText, CheckSquare, Info, Menu, X } from 'lucide-react';
import { User } from './types';

// --- CONTEXTS ---

const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
} | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

// --- COMPONENTS ---

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SubjectSelection from './pages/SubjectSelection';
import MatchingPage from './pages/MatchingPage';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import NotesPage from './pages/NotesPage';
const APP_MENU_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: CheckSquare, label: 'Weekly Tasks', path: '/tasks' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
  { icon: Info, label: 'Group Info', path: '/group-info' },
  { icon: NotebookText, label: 'Notes', path: '/notes' },
  { icon: UserIcon, label: 'Profile', path: '/profile' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-gradient-to-r from-black via-slate-950 to-purple-950 border-b border-purple-500/20 shadow-[0_6px_30px_rgba(124,58,237,0.25)]">
      <div className="h-full flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { navigate('/'); setMobileMenuOpen(false); }}>
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">P</div>
        <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-300 via-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
          PeerStudy
        </span>
      </div>
      
      <div className="hidden md:flex items-center gap-4">
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-200">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-white/15 min-w-0">
            <div className="hidden sm:block text-right min-w-0 max-w-[220px]">
              <p className="text-sm font-semibold truncate text-slate-100" title={user.name}>{user.name}</p>
              <p className="text-xs text-slate-300 truncate" title={user.branch}>{user.branch}</p>
            </div>
            <button onClick={logout} className="p-2 text-slate-300 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={20} />
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        className="md:hidden p-2 rounded-lg text-slate-100 hover:bg-white/10 transition-colors"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[72px] left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-b border-purple-500/20 shadow-xl">
          <div className="px-4 py-3 space-y-2">
            {user && APP_MENU_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${
                  location.pathname === item.path
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <item.icon size={18} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button onClick={toggleTheme} className="px-3 py-2 rounded-lg bg-white/10 text-slate-100 inline-flex items-center gap-2">
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                Theme
              </button>
              {user && (
                <button onClick={logout} className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-300 inline-flex items-center gap-2">
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-[72px] bottom-0 w-64 glass border-r-0 hidden md:flex flex-col p-4 gap-2">
      {APP_MENU_ITEMS.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            location.pathname === item.path 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <item.icon size={20} />
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </aside>
  );
};

const Layout = ({ children, showSidebar = true }: { children: React.ReactNode, showSidebar?: boolean }) => {
  return (
    <div className="min-h-screen pt-[72px]">
      <Navbar />
      <div className="flex">
        {showSidebar && <Sidebar />}
        <main className={`flex-1 p-6 ${showSidebar ? 'md:ml-64' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// --- APP ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (token) {
      fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) setUser(data);
        else logout();
      })
      .catch(() => logout());
    }
  }, [token]);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const updateUser = (updated: Partial<User>) => {
    if (user) setUser({ ...user, ...updated });
  };

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
        <Router>
          <Routes>
            <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/" />} />
            
            <Route path="/" element={token ? (
              user?.group_id ? <Navigate to="/dashboard" /> : <Navigate to="/subjects" />
            ) : <Navigate to="/login" />} />

            <Route path="/subjects" element={token ? (
              <Layout showSidebar={false}><SubjectSelection /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/match" element={token ? (
              <Layout showSidebar={false}><MatchingPage /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/dashboard" element={token ? (
              <Layout><Dashboard /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/chat" element={token ? (
              <Layout><Dashboard activeTab="chat" /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/progress" element={token ? (
              <Layout><Dashboard activeTab="progress" /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/tasks" element={token ? (
              <Layout><Dashboard activeTab="tasks" /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/group-info" element={token ? (
              <Layout><Dashboard activeTab="info" /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/notes" element={token ? (
              <Layout><NotesPage /></Layout>
            ) : <Navigate to="/login" />} />

            <Route path="/profile" element={token ? (
              <Layout><ProfilePage /></Layout>
            ) : <Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
