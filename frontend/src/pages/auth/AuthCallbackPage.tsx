import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleGoogleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Token is sent as URL fragment (#token=xxx) for security
      const hash = window.location.hash;
      const tokenMatch = hash.match(/token=([^&]+)/);

      if (!tokenMatch) {
        setError('No authentication token received. Please try logging in again.');
        return;
      }

      const token = tokenMatch[1];

      try {
        await handleGoogleCallback(token);
        // Clear the hash from URL for cleanliness
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    };

    processCallback();
  }, [navigate, handleGoogleCallback]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4">
          <div className="bg-card rounded-lg border p-6 text-center space-y-4">
            <div className="text-destructive text-sm font-medium">Authentication Error</div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-4">
        <div className="bg-card rounded-lg border p-6 text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Completing Google sign-in...</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
