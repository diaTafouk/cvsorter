import React from 'react';
import { MapPin, Briefcase, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export const CandidateCard = ({ candidate, onViewDetails }) => {
  const { firstName, lastName, country, jobTitle, evaluation } = candidate;
  const score = evaluation?.score || 0;

  const getScoreBadge = (s) => {
    if (s >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (s >= 60) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{firstName} {lastName}</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {country}</span>
            <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {jobTitle}</span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${getScoreBadge(score)}`}>
          Score IA: {score}%
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          "{evaluation?.summary || 'Analyse en cours...'}"
        </p>

        <div className="flex flex-wrap gap-1.5">
          {evaluation?.matchedSkills?.slice(0, 4).map((skill) => (
            <span key={skill} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> {skill}
            </span>
          ))}
          {evaluation?.missingSkills?.slice(0, 2).map((skill) => (
            <span key={skill} className="px-2 py-0.5 bg-rose-50 text-rose-700 text-xs rounded font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {skill}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onViewDetails(candidate)}
        className="w-full py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
      >
        <FileText className="w-4 h-4" /> Voir l'Analyse Détaillée
      </button>
    </div>
  );
};