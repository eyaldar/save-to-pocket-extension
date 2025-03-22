import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Providers from '../shared/providers/Providers';
import '../styles/global.css';

// Create root element
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);

// Render app with providers
root.render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);