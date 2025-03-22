import React from 'react';
import { createRoot } from 'react-dom/client';
import OptionsPage from './options';
import Providers from '../shared/providers/Providers';
import '../styles/global.css';

// Create root element
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);

// Render options page with providers
root.render(
  <React.StrictMode>
    <Providers>
      <OptionsPage />
    </Providers>
  </React.StrictMode>
); 