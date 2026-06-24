// src/App.jsx
// The main application router.
// Handles protected routes — if you don't have a token, you get kicked to /login.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store/useStore';
import AuthPage from './pages/AuthPage';
import BoardsList from './pages/BoardsList';
import BoardPage from './pages/BoardPage';
import ProfilePage from './pages/ProfilePage';
import TreeEditorPage from './pages/TreeEditorPage';
import CategoryPage from './pages/CategoryPage';

// A wrapper component that checks for authentication.
// If not authenticated, redirects to /login.
const ProtectedRoute = ({ children }) => {
  const token = useStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  const token = useStore((state) => state.token);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route 
          path="/login" 
          element={token ? <Navigate to="/" replace /> : <AuthPage />} 
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BoardsList />
            </ProtectedRoute>
          }
        />
        <Route path="/b/:boardId" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/trees" element={<ProtectedRoute><TreeEditorPage /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />

        {/* Catch-all 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
