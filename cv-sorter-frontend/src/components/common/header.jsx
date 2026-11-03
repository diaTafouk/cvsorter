import React from 'react';
import { useApp } from '../../context/AppContext';
import { Server, Users, Award, ShieldCheck } from 'lucide-react';

export const Header = () => {
  const { candidates } = useApp();

  const totalCandidates = candidates.length;
  const selectedCandidates = candidates.filter(
    (c) => (c.evaluation?.score || 0) >= 70
  ).length;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-300 py-3 px-4 sm:px-8 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Statut Moteur IA */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Ollama Local (Llama 3 / Mistral) : Connecté
          </span>
        </div>

        {/* Statistiques rapides */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Total CVs : <strong className="text-white">{totalCandidates}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pré-sélectionnés : <strong className="text-white">{selectedCandidates}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Stockage local actif</span>
          </div>
        </div>
      </div>
    </div>
  );
};