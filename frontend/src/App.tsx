/**
 * Root application component.
 *
 * Sets up the provider hierarchy for the entire app:
 * 1. AuthProvider  – manages user authentication state across the tree
 * 2. InactivityManager – silently tracks user activity and enforces session timeout
 * 3. InactivityWarning – modal that warns before forced logout
 * 4. BrowserRouter – client-side routing
 * 5. AppRoutes – route definitions and navigation guards
 */

import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { AuthProvider } from './context/AuthContext';
import InactivityManager from './components/InactivityManager';
import InactivityWarning from './components/InactivityWarning';

function App() {
  return (
    <AuthProvider>
      {/* Rendered as null; manages inactivity timers in the background */}
      <InactivityManager />
      {/* Listens for inactivity:warning custom events and shows the modal */}
      <InactivityWarning />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
