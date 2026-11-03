import React, { useState } from 'react';
import { FileText, Copy, Check, Search, Highlighting } from 'lucide-react';

export const CVReader = ({ rawText, fileName, matchedSkills = [], missingSkills = [] }) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fonction pour surligner les compétences clés dans le texte
  const renderHighlightedText = () => {
    if (!rawText) return <span className="text-slate-500 italic">Aucun contenu extrait.</span>;

    let content = rawText;

    if (searchTerm) {
      const parts = content.split(new RegExp(`(${searchTerm})`, 'gi'));
      return parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={index} className="bg-amber-300 text-slate-900 rounded px-1">
            {part}
          </mark>
        ) : (
          part
        )
      );
    }

    return content;
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 text-slate-200 overflow-hidden shadow-xl">
      {/* Barre d'outils du lecteur */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="truncate max-w-[200px]">{fileName || 'document.pdf'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Recherche dans le texte */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Chercher mot-clé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Bouton Copier */}
          <button
            onClick={handleCopy}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1 transition-colors"
            title="Copier le texte brut"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Résumé rapide des compétences détectées par le reader */}
      {(matchedSkills.length > 0 || missingSkills.length > 0) && (
        <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 text-xs flex flex-wrap gap-2 items-center">
          <span className="text-slate-400 text-[11px] font-semibold uppercase">Mots-clés :</span>
          {matchedSkills.map((skill) => (
            <span key={skill} className="bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono text-[11px]">
              ✓ {skill}
            </span>
          ))}
          {missingSkills.map((skill) => (
            <span key={skill} className="bg-rose-950 text-rose-400 border border-rose-800/60 px-2 py-0.5 rounded font-mono text-[11px]">
              ✗ {skill}
            </span>
          ))}
        </div>
      )}

      {/* Contenu textuel */}
      <div className="p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-600 selection:text-white">
        {renderHighlightedText()}
      </div>
    </div>
  );
};

export default CVReader;