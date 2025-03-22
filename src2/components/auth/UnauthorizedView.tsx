import React from 'react';
import { useAuth } from '../../shared/hooks';
import Spinner from '../common/Spinner';

const UnauthorizedView: React.FC = () => {
  const { auth, login } = useAuth();

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[300px]">
      <div className="mb-6 text-center">
        <img 
          src="../assets/icons/icon128.png" 
          alt="Pocket Logo" 
          className="w-16 h-16 mx-auto mb-3"
        />
        <h1 className="text-lg font-semibold text-gray-800">Save to Pocket</h1>
        <p className="text-sm text-gray-600 mt-1">
          Save articles, videos and more
        </p>
      </div>

      {auth.error && (
        <div className="status-message status-error mb-4 w-full text-sm">
          Unable to log in: {auth.error}
        </div>
      )}

      <button
        className="pocket-button w-full hover:bg-red-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors"
        onClick={login}
        disabled={auth.isAuthenticating}
      >
        {auth.isAuthenticating ? (
          <>
            <Spinner size="sm" />
            <span className="ml-2">Logging in...</span>
          </>
        ) : (
          'Log in with Pocket'
        )}
      </button>

      <p className="mt-4 text-xs text-gray-500 text-center">
        Don't have an account?{' '}
        <a
          href="https://getpocket.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="pocket-red hover:text-red-700 hover:underline"
        >
          Sign up for Pocket
        </a>
      </p>
    </div>
  );
};

export default UnauthorizedView; 