import React, { useState } from 'react';
import { LayoutDashboard, UploadCloud, Sliders, Database, ShieldCheck } from 'lucide-react';

import DashboardPage from './components/pages/DashboardPage';
import CandidatePage from './components/pages/CandidatePage';
import ConfigurationPage from './components/pages/ConfigurationPage';
import DatabaseCrudPage from './components/pages/DatabaseCrudPage';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="bg-slate-800/80 border-b border-slate-700/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight m-0">
                CV SmartFilter IA
              </h1>
              <p className="text-xs text-indigo-300 font-medium">
                Présélection des candidatures • Traitement local • PostgreSQL
              </p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard & Tri</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Espace Candidat</span>
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'config' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Configuration IA</span>
            </button>

            <button
              onClick={() => setActiveTab('crud')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'crud' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Gestion DB (CRUD)</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'upload' && <CandidatePage />}
        {activeTab === 'config' && <ConfigurationPage />}
        {activeTab === 'crud' && <DatabaseCrudPage />}
      </main>
    </div>
  );
}

export default App;