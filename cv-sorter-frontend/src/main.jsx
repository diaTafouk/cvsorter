import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx'; // <--- Import du Provider
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider> {/* <--- Enveloppe l'application entière */}
      <App />
    </AppProvider>
  </React.StrictMode>
);