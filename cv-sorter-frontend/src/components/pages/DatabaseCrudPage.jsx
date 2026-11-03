import React, { useState, useEffect } from 'react';
import { Database, Trash2, RefreshCw, Archive, Lock, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const DatabaseCrudPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [data, setData] = useState({ active: [], archived: [] });
  const [loading, setLoading] = useState(false);

  // Vérification du mot de passe saisi
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await axios.post('/api/admin/verify-password', { password: passwordInput });
      if (res.data.success) {
        setIsAuthenticated(true);
        loadDbData();
      }
    } catch (err) {
      setAuthError('Mot de passe administrateur incorrect.');
    }
  };

  const loadDbData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/candidates');
      setData(res.data || { active: [], archived: [] });
    } catch (err) {
      console.error('Erreur chargement DB:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (id) => {
    if (window.confirm(`Supprimer définitivement le candidat ID ${id} ?`)) {
      try {
        await axios.delete(`/api/admin/candidates/${id}`);
        loadDbData();
      } catch (err) {
        alert('Erreur de suppression');
      }
    }
  };

  const handlePurgeAll = async () => {
    if (window.confirm("⚠️ ACTION IRRÉVERSIBLE : Purger l'intégralité des tables PostgreSQL (Actifs + Archives) ?")) {
      try {
        await axios.delete('/api/admin/purge-all');
        loadDbData();
        alert('Base de données intégralement réinitialisée !');
      } catch (err) {
        alert('Erreur lors de la purge');
      }
    }
  };

  // --- 1. ÉCRAN DE VERROUILLAGE (SI NON AUTHENTIFIÉ) ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-slate-800/80 border border-slate-700 p-8 rounded-2xl shadow-2xl space-y-6 text-slate-100 backdrop-blur-md">
        <div className="text-center space-y-2">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-indigo-500/30">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white">Accès Restreint Admin</h2>
          <p className="text-xs text-slate-400">
            Entrez le mot de passe administrateur configuré pour accéder à la gestion directe PostgreSQL.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Mot de passe
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            Déverrouiller la Gestion DB
          </button>
        </form>
      </div>
    );
  }

  // --- 2. ACCÈS AUTORISÉ (TABLES ET ACTIONS CRUD) ---
  return (
    <div className="max-w-6xl mx-auto space-y-8 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Database className="w-7 h-7 text-indigo-500" /> Administration Directe PostgreSQL (CRUD)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualisez et gérez physiquement les enregistrements présents en base de données.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDbData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir DB
          </button>
          <button
            onClick={handlePurgeAll}
            className="px-4 py-2 bg-rose-900/80 hover:bg-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 border border-rose-700 text-rose-200 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Purge Totale DB
          </button>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3 py-2 bg-slate-900 text-xs font-bold text-slate-400 hover:text-white rounded-xl border border-slate-800 transition cursor-pointer"
          >
            Verrouiller
          </button>
        </div>
      </div>

      {/* Table des Candidats Actifs */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Candidats Actifs ({data.active.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-700">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Nom</th>
                <th className="p-3">Poste</th>
                <th className="p-3">Pays</th>
                <th className="p-3">Score</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.active.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">Aucun candidat actif en base de données.</td>
                </tr>
              ) : (
                data.active.map((item) => {
                  const ev = typeof item.evaluation === 'string' ? JSON.parse(item.evaluation) : item.evaluation || {};
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-mono text-slate-400">{item.id}</td>
                      <td className="p-3 font-bold text-white">{item.name || 'N/A'}</td>
                      <td className="p-3 text-indigo-300">{item.job_title || item.jobtitle || 'N/A'}</td>
                      <td className="p-3 text-slate-300">{item.country || 'Mali'}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded-md font-bold">{ev.score || 0}%</span></td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteSingle(item.id)}
                          className="p-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg transition cursor-pointer"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table des Candidats Archivés */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-400" /> Archives de Réinitialisation ({data.archived.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-700">
              <tr>
                <th className="p-3">ID Arch.</th>
                <th className="p-3">Nom</th>
                <th className="p-3">Poste</th>
                <th className="p-3">Supprimé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.archived.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">Aucune donnée archivée.</td>
                </tr>
              ) : (
                data.archived.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-mono text-slate-400">{item.id}</td>
                    <td className="p-3 text-slate-300">{item.name || 'N/A'}</td>
                    <td className="p-3 text-slate-400">{item.job_title || 'N/A'}</td>
                    <td className="p-3 text-amber-300 font-mono">{new Date(item.deleted_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DatabaseCrudPage;