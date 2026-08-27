import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { AuthProvider } from './context/AuthContext';
import InactivityManager from './components/InactivityManager';
import InactivityWarning from './components/InactivityWarning';

function App() {
  return (
    <AuthProvider>
      <InactivityManager />
      <InactivityWarning />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
