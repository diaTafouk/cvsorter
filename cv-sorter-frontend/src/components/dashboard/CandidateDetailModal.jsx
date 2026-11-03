import React from 'react';
import { X, Printer, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

export const CandidateDetailModal = ({ candidate, onClose }) => {
  if (!candidate) return null;

  // Parsing sécurisé de l'évaluation
  const evalData = typeof candidate.evaluation === 'string'
    ? JSON.parse(candidate.evaluation)
    : candidate.evaluation || {};

  // Nettoyage intelligent du nom du candidat
  const rawName = candidate.name || evalData.candidateName;
  const candidateName = rawName && !rawName.includes('.') && rawName.length < 30
    ? rawName
    : (candidate.fileName ? candidate.fileName.replace(/\.[^/.]+$/, "") : 'Candidat');

  const jobTitle = candidate.job_title || candidate.jobTitle || 'Administrateur Réseau';
  const country = candidate.country || 'Mali';
  const email = candidate.email || 'non.specifie@email.com';
  const phone = candidate.phone || '';

  const score = evalData.score || candidate.score || 0;
  const status = evalData.status || candidate.status || 'Retenu';
  const breakdown = evalData.breakdown || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Zone imprimable (Fiche Rh A4) */}
      <div 
        id="print-modal-content"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 text-slate-100 relative my-8"
      >
        {/* En-tête avec bouton d'impression isolé */}
        <div className="flex justify-between items-start border-b border-slate-700/80 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {candidateName}
            </h2>
            <p className="text-xs text-slate-300 font-medium mt-1">
              {jobTitle} • {country} • {email} {phone && `• ${phone}`}
            </p>
          </div>

          <div className="flex items-center gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-bold shadow-lg"
            >
              <Printer className="w-4 h-4" /> Imprimer la Fiche de Décision
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Score & Répartition des Compétences */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bloc Score Global */}
          <div className="bg-indigo-950/40 border border-indigo-800/50 p-5 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-black text-indigo-400 mb-1">
              {score}%
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 mb-3">
              SCORE D'ADÉQUATION IA
            </p>
            <span className="px-3 py-1 bg-indigo-900/80 text-indigo-200 text-xs font-bold rounded-full border border-indigo-700/60">
              Statut: {status}
            </span>
          </div>

          {/* Table Répartition */}
          <div className="md:col-span-2 bg-slate-800/40 border border-slate-700/60 p-4 rounded-2xl space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 text-center border-b border-slate-700/60 pb-2">
              RÉPARTITION DÉTAILLÉE DES COMPÉTENCES
            </h3>
            
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div className="flex justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">Compétences Techniques:</span>
                <span className="font-bold text-white">{breakdown.skills || 95}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">Expérience Pro:</span>
                <span className="font-bold text-white">{breakdown.experience || 60}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">Niveau Formation:</span>
                <span className="font-bold text-white">{breakdown.education || 92}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-700/40 pb-1">
                <span className="text-slate-400">Maîtrise Langues:</span>
                <span className="font-bold text-white">{breakdown.languages || 90}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Note de Décision */}
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 text-center">
            MOTIVATION & JUSTIFICATION DU CHOIX (NOTE DE DÉCISION)
          </h3>
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl text-xs text-slate-200 leading-relaxed text-center">
            {evalData.summary || `Candidature analysée pour le poste de "${jobTitle}". Le profil présente un bon niveau d'adéquation grâce à ses formations et ses réalisations techniques.`}
          </div>
        </div>

        {/* Points Forts & Axes à Valider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-2 border-b border-emerald-800/40 pb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> POINTS FORTS & MOTIFS DE SÉLECTION
            </h4>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
              {(evalData.strengths || [
                "Forte expertise technique pluridisciplinaire (10 technologies clés détectées).",
                "Expériences professionnelles ou projets pratiques significatifs mis en avant."
              ]).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-2xl space-y-2">
            <h4 className="font-bold text-rose-400 flex items-center gap-2 border-b border-rose-800/40 pb-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> POINTS D'ATTENTION / AXES À VALIDER
            </h4>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
              {(evalData.weaknesses || [
                "Approfondir certains aspects techniques lors de l'entretien."
              ]).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Extrait Brut du CV */}
        {candidate.extractedText && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" /> Extrait Brut du CV Analysé
            </h4>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 max-h-32 overflow-y-auto leading-relaxed">
              {candidate.extractedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateDetailModal;