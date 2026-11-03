import React, { useMemo, useState } from 'react';
import {
  Search, Filter, Award, Eye, FileSpreadsheet, Printer, Briefcase, MapPin, UserCheck, Users,
  RotateCcw, Loader2, AlertTriangle, ListOrdered, Ban, Clock, Flag, Trophy, LayoutGrid, Rows3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { CandidateDetailModal } from '../modals/CandidateDetailModal';

export const DECISION_STYLES = {
  'Présélectionné': 'bg-emerald-950/80 border-emerald-700 text-emerald-300',
  'Liste de réserve': 'bg-amber-950/80 border-amber-700 text-amber-300',
  'Non retenu': 'bg-slate-800 border-slate-600 text-slate-300',
  'Non recevable': 'bg-rose-950/80 border-rose-800 text-rose-300'
};

const parseEval = (c) => {
  try {
    return (typeof c.evaluation === 'string' ? JSON.parse(c.evaluation) : c.evaluation) || {};
  } catch {
    return {};
  }
};

export const DashboardPage = () => {
  const { candidates = [], jobCriteria = [], loading, referentiel, countries = [], archiveCandidates } = useApp();

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedSc, setSelectedSc] = useState('ALL');
  const [selectedJob, setSelectedJob] = useState('ALL');
  const [selectedDecision, setSelectedDecision] = useState('ALL');
  const [onlyToVerify, setOnlyToVerify] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [resetting, setResetting] = useState(false);
  // « Les N meilleurs par poste » : 'poste' = nombre de convoqués défini pour chaque poste, 0 = tous
  const [topN, setTopN] = useState('poste');
  const [customTopN, setCustomTopN] = useState('');
  const [viewMode, setViewMode] = useState('cartes'); // cartes | classement

  const sousCommissions = referentiel?.sousCommissions || [];
  const safeCandidates = useMemo(
    () => (Array.isArray(candidates) ? candidates : []).map((c) => ({ ...c, _eval: parseEval(c) })),
    [candidates]
  );
  const jobsOfSc = jobCriteria.filter((j) => selectedSc === 'ALL' || j.sous_commission === selectedSc);
  const scOfCandidate = (c) => c.sous_commission || c._eval?.criteres?.sous_commission || jobCriteria.find((j) => j.title === c.job_title)?.sous_commission;

  // Archive les dossiers analysés pour désengorger le tableau de bord (rien n'est perdu : table archived_candidates)
  const handleResetCVs = async () => {
    const scoped = selectedJob !== 'ALL';
    const n = scoped ? safeCandidates.filter((c) => c.job_title === selectedJob).length : safeCandidates.length;
    if (!n) return alert('Aucun dossier à archiver.');
    const msg = scoped
      ? `Archiver les ${n} dossier(s) du poste « ${selectedJob} » et les retirer du tableau de bord ?`
      : `Archiver les ${n} dossier(s) analysés et vider le tableau de bord ?\n\nAstuce : sélectionnez d'abord un poste pour n'archiver que ses dossiers.`;
    if (!window.confirm(msg)) return;
    setResetting(true);
    const r = await archiveCandidates(scoped ? selectedJob : null);
    setResetting(false);
    setSelectedCandidate(null);
    alert(r.ok ? `${r.archived ?? n} dossier(s) archivé(s). Ils restent consultables dans « Gestion DB ».` : `Échec de l'archivage : ${r.error}`);
  };

  const filteredCandidates = safeCandidates
    .filter((c) => {
      const e = c._eval;
      const score = Number(e?.score ?? c.score ?? 0);
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || (c.name || '').toLowerCase().includes(q) || (c.job_title || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
      return (
        matchesSearch &&
        (selectedCountry === 'ALL' || c.country === selectedCountry) &&
        (selectedSc === 'ALL' || scOfCandidate(c) === selectedSc) &&
        (selectedJob === 'ALL' || c.job_title === selectedJob) &&
        (selectedDecision === 'ALL' || (e.decision || c.status) === selectedDecision) &&
        (!onlyToVerify || e.aVerifier) &&
        score >= minScore
      );
    })
    .sort((a, b) => {
      if (a.job_title !== b.job_title) return (a.job_title || '').localeCompare(b.job_title || '');
      return (a.rang ?? 9999) - (b.rang ?? 9999) || Number(b._eval.score || 0) - Number(a._eval.score || 0);
    });

  // Les N meilleurs dossiers recevables de chaque poste (dans l'ordre du classement §17).
  // Les dossiers non recevables ne font jamais partie d'un « top N ».
  const limitFor = (title) => {
    if (topN === 'poste') {
      const n = Number(jobCriteria.find((j) => j.title === title)?.max_convoques);
      return n > 0 ? n : null; // non défini pour ce poste → tous les dossiers recevables
    }
    return topN || null;
  };
  const displayedCandidates = useMemo(() => {
    // « Non recevables » demandés explicitement : on les montre tous (un Top N les exclut)
    if (!topN || selectedDecision === 'Non recevable') return filteredCandidates;
    const seen = {};
    return filteredCandidates.filter((c) => {
      if ((c._eval.decision || c.status) === 'Non recevable' || c.rang == null) return false;
      const limit = limitFor(c.job_title);
      seen[c.job_title] = (seen[c.job_title] || 0) + 1;
      return !limit || seen[c.job_title] <= limit;
    });
  }, [filteredCandidates, topN, jobCriteria, selectedDecision]);
  const topLabel = (title) => {
    if (!topN) return '';
    const n = limitFor(title);
    if (topN === 'poste') return n ? `${n} convoqué(s) prévu(s) — ` : 'Nombre de convoqués non défini — ';
    return `Top ${n} — `;
  };

  const groups = useMemo(() => {
    const g = {};
    for (const c of displayedCandidates) (g[c.job_title || '—'] = g[c.job_title || '—'] || []).push(c);
    return Object.entries(g);
  }, [displayedCandidates]);
  const totalByJob = useMemo(() => {
    const t = {};
    for (const c of filteredCandidates) t[c.job_title] = (t[c.job_title] || 0) + 1;
    return t;
  }, [filteredCandidates]);

  const applyTop = (value) => {
    if (value === 'custom') { setTopN(Number(customTopN) || 0); return; }
    if (value === 'poste') { setTopN('poste'); setViewMode('classement'); return; }
    setTopN(Number(value));
    if (Number(value)) setViewMode('classement');
  };

  const countBy = (d) => safeCandidates.filter((c) => (c._eval.decision || c.status) === d).length;
  const toVerify = safeCandidates.filter((c) => c._eval.aVerifier).length;

  // Répartition par nationalité des présélectionnés (quota 1/3 de représentation des États membres)
  const jobObj = jobCriteria.find((j) => j.title === selectedJob);
  const quotaStats = useMemo(() => {
    if (!jobObj || jobObj.categorie !== 'QUOTA_AES') return null;
    const pre = safeCandidates.filter((c) => c.job_title === jobObj.title && c._eval.decision === 'Présélectionné');
    return (jobObj.nationalites_eligibles || []).map((p) => ({ pays: p, n: pre.filter((c) => c.country === p).length, total: pre.length }));
  }, [jobObj, safeCandidates]);

  const exportExcel = () => {
    const toRow = (c) => {
      const e = c._eval;
      return {
        Poste: c.job_title,
        'Sous-commission': scOfCandidate(c) || '',
        Rang: c.rang ?? '',
        'Prénom et nom': c.name,
        Nationalité: c.country,
        'Note de présélection /100': e.score ?? '',
        Statut: e.decision || c.status,
        'À vérifier': e.aVerifier ? 'Oui' : '',
        Convoqué: c.convoque ? 'Oui' : '',
        'Diplôme détecté': e.details?.diplome?.detecte || '',
        'Expérience (ans)': e.details?.experience?.annees ?? '',
        'Expérience pertinente (ans)': e.details?.experience?.anneesPertinentes ?? '',
        'Motifs de non-recevabilité': (e.eliminations || []).map((x) => x.motif).join(' | '),
        'Points à vérifier': (e.verifications || []).map((x) => x.motif).join(' | '),
        Départage: c.departageMotif || (c.exAequo ? 'Ex æquo' : ''),
        Email: c.email || '',
        Téléphone: c.phone || ''
      };
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(displayedCandidates.map(toRow)), topN === 'poste' ? 'Convoqués par poste' : topN ? `Top ${topN} par poste` : 'Classement');
    // Une feuille par poste (noms Excel : 31 caractères max, uniques, sans : \ / ? * [ ])
    const used = new Set();
    for (const [title, list] of groups) {
      let name = title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 28).trim() || 'Poste';
      let k = 2;
      while (used.has(name)) name = `${name.slice(0, 26)} ${k++}`;
      used.add(name);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.map(toRow)), name);
    }
    XLSX.writeFile(wb, `Preselection_${topN === 'poste' ? 'convoques_' : topN ? `top${topN}_` : ''}${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const Stat = ({ icon: Icon, label, value, tone, onClick, active }) => (
    <button onClick={onClick} className={`text-left bg-slate-800/60 border p-4 rounded-2xl flex items-center gap-3 transition cursor-pointer ${active ? 'border-indigo-500' : 'border-slate-700/60 hover:border-slate-500'}`}>
      <div className={`p-2.5 rounded-xl ${tone}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-bold">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
      </div>
    </button>
  );

  const selectCls = 'bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-6 text-slate-100">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={Users} label="Dossiers" value={safeCandidates.length} tone="bg-indigo-600/20 text-indigo-400" onClick={() => setSelectedDecision('ALL')} active={selectedDecision === 'ALL'} />
        <Stat icon={UserCheck} label="Présélectionnés" value={countBy('Présélectionné')} tone="bg-emerald-600/20 text-emerald-400" onClick={() => setSelectedDecision('Présélectionné')} active={selectedDecision === 'Présélectionné'} />
        <Stat icon={Clock} label="Liste de réserve" value={countBy('Liste de réserve')} tone="bg-amber-600/20 text-amber-400" onClick={() => setSelectedDecision('Liste de réserve')} active={selectedDecision === 'Liste de réserve'} />
        <Stat icon={Award} label="Non retenus" value={countBy('Non retenu')} tone="bg-slate-600/30 text-slate-300" onClick={() => setSelectedDecision('Non retenu')} active={selectedDecision === 'Non retenu'} />
        <Stat icon={Ban} label="Non recevables" value={countBy('Non recevable')} tone="bg-rose-600/20 text-rose-400" onClick={() => setSelectedDecision('Non recevable')} active={selectedDecision === 'Non recevable'} />
        <Stat icon={AlertTriangle} label="À vérifier" value={toVerify} tone="bg-orange-600/20 text-orange-400" onClick={() => setOnlyToVerify((v) => !v)} active={onlyToVerify} />
      </div>

      {/* Filtres */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-5 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-400" /> Présélection et classement par poste
          </h2>
          <div className="flex items-center gap-2 no-print">
            <button onClick={handleResetCVs} disabled={resetting}
              className="px-3.5 py-2 bg-rose-900/60 hover:bg-rose-800 border border-rose-700/80 text-xs font-semibold text-rose-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Archiver en base de données et réinitialiser">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 text-rose-300" />}
              <span>{selectedJob !== 'ALL' ? 'Archiver ce poste' : 'Réinitialiser CVs'}</span>
            </button>
            <button onClick={exportExcel} disabled={!displayedCandidates.length}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
            </button>
            <button onClick={() => window.print()} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl flex items-center gap-1.5 transition cursor-pointer">
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input type="text" placeholder="Nom, poste, email…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className={selectCls}>
            <option value="ALL">Toutes nationalités</option>
            {countries.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={selectedSc} onChange={(e) => { setSelectedSc(e.target.value); setSelectedJob('ALL'); }} className={selectCls}>
            <option value="ALL">Toutes sous-commissions</option>
            {sousCommissions.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.libelle}</option>)}
          </select>
          <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} className={selectCls}>
            <option value="ALL">Tous les postes</option>
            {jobsOfSc.map((job) => <option key={job.code || job.id} value={job.title}>{job.title}</option>)}
          </select>
          <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl flex flex-col justify-center">
            <label className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
              <span>Note min.</span><span className="text-indigo-400 font-black">{minScore}/100</span>
            </label>
            <input type="range" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer" />
          </div>
        </div>

        {/* Meilleurs candidats par poste + mode d'affichage */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-3 text-xs">
          <span className="font-bold text-amber-300 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Meilleurs candidats par poste :</span>
          {['poste', 0, 5, 10, 20, 50].map((n) => (
            <button key={n} onClick={() => applyTop(n)}
              title={n === 'poste' ? 'Nombre maximal de convoqués défini pour chaque poste dans Configuration IA' : undefined}
              className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${topN === n ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}>
              {n === 'poste' ? 'Selon le poste' : n === 0 ? 'Tous' : `Top ${n}`}
            </button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); applyTop('custom'); if (Number(customTopN)) setViewMode('classement'); }} className="flex items-center gap-1.5">
            <input type="number" min="1" max="500" value={customTopN} onChange={(e) => setCustomTopN(e.target.value)} placeholder="N"
              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white" aria-label="Nombre de candidats à retenir par poste" />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer">Appliquer</button>
          </form>
          <span className="text-slate-400">
            {topN ? `${displayedCandidates.length} candidat(s) retenu(s) sur ${filteredCandidates.length} dossier(s), ${groups.length} poste(s)` : `${filteredCandidates.length} dossier(s) affiché(s)`}
          </span>
          <div className="ml-auto flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 no-print">
            <button onClick={() => setViewMode('cartes')} className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-bold cursor-pointer ${viewMode === 'cartes' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><LayoutGrid className="w-3.5 h-3.5" /> Cartes</button>
            <button onClick={() => setViewMode('classement')} className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-bold cursor-pointer ${viewMode === 'classement' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Rows3 className="w-3.5 h-3.5" /> Classement</button>
          </div>
        </div>

        {jobObj && (
          <div className="flex flex-wrap items-center gap-3 text-xs border-t border-slate-700/60 pt-3">
            <span className="text-slate-400"><Briefcase className="w-3.5 h-3.5 inline mr-1" />{jobObj.nombre_postes} poste(s) à pourvoir · {jobObj.lieu}</span>
            {jobObj.max_convoques && <span className="text-slate-400">· {jobObj.max_convoques} candidat(s) max. convoqué(s) aux épreuves</span>}
            {quotaStats && (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">· Présélectionnés par nationalité (quota de représentation) :</span>
                {quotaStats.map((q) => (
                  <span key={q.pays} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200">{q.pays} : <b>{q.n}</b></span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grille des candidats */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement des candidats...</div>
      ) : displayedCandidates.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-12 text-center text-slate-400">Aucun candidat ne correspond aux filtres sélectionnés.</div>
      ) : viewMode === 'classement' ? (
        <div className="space-y-5">
          {groups.map(([title, list]) => {
            const job = jobCriteria.find((j) => j.title === title);
            return (
              <section key={title} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700/70">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2"><Briefcase className="w-4 h-4 text-indigo-400" /> {title}</h3>
                  <span className="text-[11px] text-slate-400">
                    {topLabel(title)}{list.length} affiché(s) sur {totalByJob[title] || list.length} dossier(s)
                    {job?.nombre_postes ? ` · ${job.nombre_postes} poste(s) à pourvoir` : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-slate-400 bg-slate-900/60">
                      <tr>
                        <th className="text-left px-3 py-2">Rang</th>
                        <th className="text-left px-3 py-2">Prénom et nom</th>
                        <th className="text-left px-3 py-2">Nationalité</th>
                        <th className="text-right px-3 py-2">Note /100</th>
                        <th className="text-left px-3 py-2">Statut</th>
                        <th className="text-left px-3 py-2">Diplôme</th>
                        <th className="text-right px-3 py-2">Exp. (ans)</th>
                        <th className="px-3 py-2 no-print"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => {
                        const e = c._eval;
                        const decision = e.decision || c.status;
                        return (
                          <tr key={c.id} className="border-t border-slate-700/50 hover:bg-slate-800/60">
                            <td className="px-3 py-2 font-black text-white">{c.rang ?? '—'}{c.exAequo ? ' =' : ''}</td>
                            <td className="px-3 py-2">
                              <span className="font-bold text-white">{(c.name || '').replace(/^\s*(cv|curriculum vitae)\s+/i, '') || c.fileName}</span>
                              {e.aVerifier && <span className="ml-2 text-[10px] text-orange-300 font-bold">à vérifier</span>}
                              {c.convoque && <span className="ml-2 text-[10px] text-sky-300 font-bold">convoqué</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{c.country || '—'}</td>
                            <td className="px-3 py-2 text-right font-extrabold text-indigo-300">{e.score ?? 0}</td>
                            <td className="px-3 py-2"><span className={`px-2 py-0.5 border font-bold rounded-md text-[10px] ${DECISION_STYLES[decision] || 'bg-slate-700 border-slate-600'}`}>{decision}</span></td>
                            <td className="px-3 py-2 text-slate-300">{e.details?.diplome?.detecte || '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{e.details?.experience?.annees ?? 0} <span className="text-slate-500">({e.details?.experience?.anneesPertinentes ?? 0} liée)</span></td>
                            <td className="px-3 py-2 text-right no-print">
                              <button onClick={() => setSelectedCandidate(c)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Détail</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCandidates.map((candidate) => {
            const e = candidate._eval;
            const score = e?.score ?? candidate.score ?? 0;
            const decision = e?.decision || candidate.status || 'En évaluation';
            const displayName = (candidate.name || '').replace(/^\s*(cv|curriculum vitae)\s+/i, '').trim()
              || (candidate.fileName ? candidate.fileName.replace(/\.[^/.]+$/, '') : 'Candidat');
            return (
              <div key={candidate.id || candidate.fileName}
                className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-indigo-500/50 transition-all shadow-lg flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white leading-snug break-words" title={displayName}>{displayName}</h3>
                      {candidate.fileName && <p className="text-[10px] text-slate-500 truncate" title={candidate.fileName}>{candidate.fileName}</p>}
                      <p className="text-xs text-indigo-300 font-medium flex items-center gap-1 mt-1">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{candidate.job_title || 'Poste non renseigné'}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2.5 py-1 bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-extrabold text-xs rounded-xl">{score}/100</span>
                      {candidate.rang && (
                        <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                          <ListOrdered className="w-3 h-3" /> {candidate.rang}{candidate.rang === 1 ? 'er' : 'e'} / {candidate.rangTotal}{candidate.exAequo ? ' (ex æquo)' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-500" />{candidate.country || '—'}</span>
                    <span className={`px-2 py-0.5 border font-bold rounded-md text-[10px] ${DECISION_STYLES[decision] || 'bg-slate-700 border-slate-600 text-slate-300'}`}>{decision}</span>
                    {e.aVerifier && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-950/80 border border-orange-800 text-orange-300 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> À vérifier</span>}
                    {candidate.convoque && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-950/80 border border-sky-800 text-sky-300 flex items-center gap-1"><Flag className="w-3 h-3" /> Convoqué</span>}
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40 leading-relaxed">
                    {e.eliminations?.length ? `Motif : ${e.eliminations[0].motif}` : e?.summary || 'Analyse en cours...'}
                  </p>
                </div>

                <button onClick={() => setSelectedCandidate(candidate)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer">
                  <Eye className="w-4 h-4" /> Voir l'analyse détaillée
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedCandidate && <CandidateDetailModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
    </div>
  );
};

export default DashboardPage;
