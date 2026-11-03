import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, X, CheckCircle, AlertCircle, Globe, Briefcase, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import axios from 'axios';

export const CandidatePage = () => {
  const { jobCriteria = [], countries = [], fetchCandidates, referentiel } = useApp();

  const activeCountries = countries.filter(c => c.active);

  const [selectedCountry, setSelectedCountry] = useState('Mali');
  const [selectedJob, setSelectedJob] = useState('');
  
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Synchroniser les valeurs par défaut dès que le contexte se charge
  useEffect(() => {
    if (activeCountries.length > 0 && !activeCountries.some(c => c.name === selectedCountry)) {
      setSelectedCountry(activeCountries[0].name);
    }
  }, [activeCountries]);

  // Postes ouverts aux ressortissants du pays sélectionné (§7 : éligibilité selon le poste)
  const eligibleJobs = jobCriteria.filter(
    (j) => j.actif !== false && (!j.nationalites_eligibles?.length || j.nationalites_eligibles.includes(selectedCountry))
  );
  const sousCommissions = referentiel?.sousCommissions || [];
  const jobGroups = [
    ...sousCommissions.map((sc) => ({ label: `${sc.code} — ${sc.libelle}`, jobs: eligibleJobs.filter((j) => j.sous_commission === sc.code) })),
    { label: 'Autres postes', jobs: eligibleJobs.filter((j) => !j.sous_commission) }
  ].filter((g) => g.jobs.length);
  const currentJob = jobCriteria.find((j) => j.title === selectedJob);
  const niveauLabel = (rank) => (referentiel?.niveaux || []).find((n) => n.rank === Number(rank))?.label || `Bac+${rank}`;

  useEffect(() => {
    if (eligibleJobs.length > 0 && !eligibleJobs.some(j => j.title === selectedJob)) {
      setSelectedJob(eligibleJobs[0].title);
    }
  }, [jobCriteria, selectedCountry]);

  // Permettre l'ajout cumulé de fichiers sans écraser les précédents
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      setUploadStatus(null);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Envoi par lots de 10 fichiers : permet d'importer une centaine de CV d'un coup
  // avec une barre de progression, sans dépasser les limites d'une seule requête.
  const BATCH_SIZE = 10;
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadStatus(null);
    setProgress({ done: 0, total: files.length });

    const created = [];
    const errs = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach((file) => formData.append('cvs', file));
      formData.append('country', selectedCountry);
      formData.append('jobTitle', selectedJob);
      if (currentJob?.code) formData.append('jobCode', currentJob.code);
      try {
        const response = await axios.post('/api/candidates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        created.push(...(response.data?.candidates || []));
        errs.push(...(response.data?.errors || []));
      } catch (err) {
        console.error('Erreur upload:', err);
        const msg = err.response?.data?.error || 'Erreur réseau';
        batch.forEach((f) => errs.push({ file: f.name, error: msg }));
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, files.length), total: files.length });
    }

    const counts = created.reduce((acc, c) => { acc[c.decision || c.status] = (acc[c.decision || c.status] || 0) + 1; return acc; }, {});
    const detail = Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ');
    setUploadStatus({
      type: errs.length && !created.length ? 'error' : 'success',
      message: `${created.length} CV(s) analysé(s)${detail ? ` : ${detail}` : ''}.` +
        (errs.length ? ` ${errs.length} fichier(s) en échec : ${errs.map((e) => `${e.file} (${e.error})`).join(' ; ')}.` : '')
    });
    // On ne garde dans la liste que les fichiers en échec, pour pouvoir les corriger et les renvoyer
    const failed = new Set(errs.map((e) => e.file));
    setFiles((prev) => prev.filter((f) => failed.has(f.name)));
    setUploading(false);
    setProgress(null);
    if (typeof fetchCandidates === 'function') fetchCandidates();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-slate-100">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Espace Candidat - Importation et Analyse IA
        </h1>
        <p className="text-xs text-slate-400">
          Sélectionnez le poste cible et le pays pour évaluer les CVs selon les critères configurés.
        </p>
      </div>

      {/* Sélection Dynamique Pays & Poste */}
      <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-xl">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-400" /> Nationalité du candidat
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {activeCountries.length > 0 ? (
              activeCountries.map((c, i) => (
                <option key={i} value={c.name}>{c.name}</option>
              ))
            ) : (
              <option value="Mali">Mali</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-indigo-400" /> Poste Cible Configurés
          </label>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {jobGroups.length > 0 ? (
              jobGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.jobs.map((j) => (
                    <option key={j.code || j.title} value={j.title}>
                      {j.title}{j.lieu && !j.lieu.startsWith('Siège') ? ` — ${j.lieu.replace('Bureau-Pays — ', '')}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))
            ) : (
              <option value="">Aucun poste ouvert aux ressortissants de ce pays</option>
            )}
          </select>
        </div>
      </div>

      {/* Rappel des critères de présélection du poste */}
      {currentJob && (
        <div className="bg-slate-800/50 border border-slate-700/60 p-4 rounded-2xl text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">{currentJob.title}</span>
            {currentJob.sous_commission && <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] font-bold">Sous-commission {currentJob.sous_commission}</span>}
            {currentJob.lieu && <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px]">{currentJob.lieu}</span>}
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px]">{currentJob.nombre_postes} poste(s)</span>
            {currentJob.verrouille && <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold">Critères verrouillés</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300">
            <p><span className="text-slate-500">Diplôme min. :</span> {niveauLabel(currentJob.min_education_rank)}</p>
            <p><span className="text-slate-500">Expérience :</span> {currentJob.min_experience_years ? `${currentJob.min_experience_years}${currentJob.max_experience_years ? ` à ${currentJob.max_experience_years}` : '+'} ans` : 'non exigée'}</p>
            <p><span className="text-slate-500">Compétences :</span> {(currentJob.competences_techniques || []).length} compétences techniques</p>
          </div>
          <p className="text-[10px] text-slate-500">
            Seuils : ≥ {currentJob.seuils?.propose ?? 70} présélectionné · ≥ {currentJob.seuils?.reserve ?? 60} liste de réserve · en dessous non retenu. Les dossiers ne remplissant pas les conditions générales sont « non recevables ».
          </p>
        </div>
      )}

      {/* Zone de Glisser-Déposer */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer?.files || []);
          if (dropped.length) { setFiles((prev) => [...prev, ...dropped]); setUploadStatus(null); }
        }}
        className="bg-slate-800/40 border-2 border-dashed border-slate-700 hover:border-indigo-500/80 transition-colors rounded-2xl p-8 text-center space-y-4"
      >
        <div className="p-4 bg-indigo-600/20 text-indigo-400 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Glissez-déposez vos fichiers CV ici</p>
          <p className="text-xs text-slate-400 mt-1">Formats acceptés : PDF (texte ou scanné), Word DOCX, photos JPG / PNG — 15 Mo max par fichier.
            Les photos et PDF scannés sont lus par reconnaissance de texte (OCR) en local : comptez quelques secondes par fichier.</p>
        </div>

        <label className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg transition">
          Parcourir les CVs
          <input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,image/*" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {/* Liste des Fichiers Sélectionnés */}
      {files.length > 0 && (
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase">Fichiers Prêts pour l'Analyse ({files.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl text-xs">
                <span className="flex items-center gap-2 text-slate-200 font-medium truncate">
                  <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  {file.name}
                </span>
                <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Lecture et présélection en cours{progress ? ` : ${progress.done} / ${progress.total} CV` : ''}...
              </>
            ) : (
              'Lancer l\'Évaluation Automatique'
            )}
          </button>
          {progress && (
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden" aria-label="Progression">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Message de Statut */}
      {uploadStatus && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          uploadStatus.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
        }`}>
          {uploadStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
};

export default CandidatePage;