import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Sliders, Save, Lock, Unlock, RotateCcw, RefreshCw, Search, AlertTriangle,
  CheckCircle, GraduationCap, Wrench, Languages, ShieldAlert, Gauge, Layers, Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TagInput } from '../config/TagInput';
import { CompetenceEditor } from '../config/CompetenceEditor';
import { CountriesForm } from '../config/CountriesForm';
import { LanguesExigees } from '../config/LanguesForm';
import { ReglesForm } from '../config/ReglesForm';
import { SousCommissionPanel, NouvelleSousCommission } from '../config/SousCommissionPanel';

const PONDERATION_LABELS = {
  diplome: 'Diplôme (niveau + domaine)',
  experience: 'Expérience (années + pertinence)',
  techniques: 'Compétences techniques',
  langues: 'Langues'
};
const SOURCE_LABELS = {
  fiche: 'Fiche de poste officielle',
  fiche_partielle: 'Fiche de poste (partielle)',
  avis: "Avis de recrutement — compétences proposées",
  manuel: 'Saisie manuelle'
};
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const sumOf = (p) => Object.keys(PONDERATION_LABELS).reduce((a, k) => a + Number(p?.[k] || 0), 0);

const Card = ({ icon: Icon, title, color = 'text-indigo-400', children, right }) => (
  <section className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
    <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 pb-2.5">
      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon className={`w-4 h-4 ${color}`} /> {title}</h3>
      {right}
    </div>
    {children}
  </section>
);
const Field = ({ label, hint, children, className = '' }) => (
  <div className={className}>
    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
  </div>
);
const inputCls = 'w-full bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60';

export const ConfigurationPage = () => {
  const {
    referentiel, jobCriteria, criteriaLoading, saveJob, addJob, lockJob, restoreJob, deleteJob,
    saveSousCommission, createSousCommission, deleteSousCommission, reevaluate, candidates,
    countries, toggleCountry, addCountry, removeCountry, updateCountryNationalites,
    regles: reglesPerso = [], saveRegle, deleteRegle, saveLangue, deleteLangue
  } = useApp();

  const sousCommissions = referentiel?.sousCommissions || [];
  const [scFilter, setScFilter] = useState('A');
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [creatingSc, setCreatingSc] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobCriteria
      .filter((j) => (scFilter === 'ALL' ? true : scFilter === 'NONE' ? !j.sous_commission : j.sous_commission === scFilter))
      .filter((j) => !q || j.job_title.toLowerCase().includes(q));
  }, [jobCriteria, scFilter, search]);

  const selected = jobCriteria.find((j) => j.code === selectedCode) || null;
  const currentSc = sousCommissions.find((s) => s.code === scFilter);

  useEffect(() => {
    if (!selectedCode && list.length) setSelectedCode(list[0].code);
  }, [list, selectedCode]);
  // Recharge le brouillon seulement si l'on change de poste ou de version (pas à chaque rafraîchissement des listes)
  useEffect(() => { setDraft(selected ? clone(selected) : null); }, [selected?.code, selected?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sous-commission affichée supprimée → première disponible
  useEffect(() => {
    if (!['ALL', 'NONE'].includes(scFilter) && sousCommissions.length && !sousCommissions.some((x) => x.code === scFilter)) {
      setScFilter(sousCommissions[0].code);
    }
  }, [sousCommissions, scFilter]);

  const flash = (type, message) => { setNotice({ type, message }); setTimeout(() => setNotice(null), 5000); };
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = draft && selected && JSON.stringify(draft) !== JSON.stringify(selected);
  const locked = !!selected?.verrouille;
  const candidatsPoste = candidates.filter((c) => c.job_title === selected?.job_title).length;

  const regles = useMemo(() => {
    const defs = referentiel?.reglesParDefaut || {};
    return Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, { ...d, ...((draft?.regles_elimination || {})[k] || {}) }]));
  }, [referentiel, draft]);
  const seuils = { ...(referentiel?.seuilsParDefaut || { propose: 70, reserve: 60 }), ...(draft?.seuils || {}) };
  const scOfDraft = sousCommissions.find((s) => s.code === draft?.sous_commission);
  const ponderations = draft?.ponderations || scOfDraft?.ponderations || {};
  const customPond = !!draft?.ponderations;

  const setRegle = (key, patch) => set({ regles_elimination: { ...(draft.regles_elimination || {}), [key]: { ...regles[key], ...patch } } });

  // ----- Actions -----
  const handleSave = async (extra = {}) => {
    if (customPond && Math.round(sumOf(ponderations)) !== 100) return flash('error', 'La somme des pondérations doit être égale à 100.');
    setBusy(true);
    const r = await saveJob({ ...draft, ...extra });
    setBusy(false);
    if (r.ok) flash('success', `Critères de « ${r.job.job_title} » enregistrés (version ${r.job.version}).`);
    else flash('error', r.error);
  };
  const handleLock = async () => {
    if (!locked && dirty) return flash('error', 'Enregistrez vos modifications avant de verrouiller.');
    const msg = locked
      ? 'Déverrouiller ce poste ? Les TdR (§13) interdisent d’introduire un critère non validé en cours de processus : ne le faites que sur décision de la Commission.'
      : 'Verrouiller les critères ? Ils ne pourront plus être modifiés pendant l’examen des candidatures (§12–13).';
    if (!window.confirm(msg)) return;
    const r = await lockJob(selected, !locked);
    flash(r.ok ? 'success' : 'error', r.ok ? (locked ? 'Poste déverrouillé.' : 'Critères verrouillés pour la durée du processus.') : r.error);
  };
  const handleRestore = async () => {
    if (!window.confirm('Remplacer les critères actuels par la fiche officielle du référentiel ?')) return;
    const r = await restoreJob(selected);
    flash(r.ok ? 'success' : 'error', r.ok ? 'Fiche officielle restaurée.' : r.error);
  };
  const handleReevaluate = async (all = false) => {
    if (dirty) return flash('error', 'Enregistrez d’abord vos modifications.');
    setBusy(true);
    const r = await reevaluate(all ? null : selected.job_title);
    setBusy(false);
    flash(r.ok ? 'success' : 'error', r.ok ? `${r.updated} CV(s) réévalué(s) avec les critères en vigueur.` : r.error);
  };
  const handleDelete = async () => {
    if (!window.confirm(`Supprimer le poste « ${selected.job_title} » de la configuration ?`)) return;
    const r = await deleteJob(selected);
    if (r.ok) { setSelectedCode(null); flash('success', 'Poste supprimé.'); } else flash('error', r.error);
  };
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const r = await addJob(newTitle.trim(), ['A', 'B', 'C', 'D'].includes(scFilter) ? scFilter : null);
    if (r.ok) { setNewTitle(''); setSelectedCode(r.job.code); flash('success', 'Poste ajouté : complétez sa fiche.'); } else flash('error', r.error);
  };
  const handleCreateSc = async (form) => {
    const r = await createSousCommission(form);
    if (r.ok) { setCreatingSc(false); setScFilter(r.sousCommission.code); setSelectedCode(null); flash('success', `Sous-commission ${r.sousCommission.code} créée.`); }
    return r;
  };
  const handleDeleteSc = async (code, reassign) => {
    const sc = sousCommissions.find((x) => x.code === code);
    if (!reassign && !window.confirm(`Supprimer la sous-commission « ${sc?.libelle || code} » ?`)) return { ok: true };
    const r = await deleteSousCommission(code, reassign);
    if (r.ok) {
      setScFilter('ALL');
      setSelectedCode(null);
      flash('success', `Sous-commission supprimée${r.postesDeplaces ? ` : ${r.postesDeplaces} poste(s) ${r.vers ? `déplacé(s) vers ${r.vers}` : 'passé(s) hors référentiel'}` : ''}.`);
    }
    return r;
  };

  if (criteriaLoading && !jobCriteria.length) {
    return <div className="text-center py-16 text-slate-400 text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement du référentiel…</div>;
  }
  if (!criteriaLoading && !jobCriteria.length) {
    return (
      <div className="max-w-2xl mx-auto bg-amber-950/40 border border-amber-800/60 rounded-2xl p-6 text-sm text-amber-200 space-y-2">
        <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Aucun poste configuré en base.</p>
        <p className="text-xs">Exécutez <code className="bg-slate-900 px-1.5 py-0.5 rounded">npm run db:migrate</code> dans le dossier du backend pour charger les postes et critères officiels.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Sliders className="w-7 h-7 text-indigo-500" /> Critères de présélection par poste
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Paramètres issus de l'avis de recrutement, des fiches de poste et des TdR de la Commission (§7 conditions générales, §10 sous-commissions,
            §12 présélection, §14 seuils et éliminations, §17 ex æquo). Le barème des épreuves (§13) et les compétences comportementales ne sont pas notés ici : ils relèvent des étapes suivantes (épreuves et entretien physique).
          </p>
        </div>
        <button
          onClick={() => handleReevaluate(true)}
          disabled={busy}
          className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Réévaluer tous les CVs
        </button>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${notice.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-rose-950/80 text-rose-300 border-rose-800'}`}>
          {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {notice.message}
        </div>
      )}

      {/* Sous-commissions */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[...sousCommissions.map((s) => ({ code: s.code, label: `${s.code} — ${s.libelle}` })), { code: 'ALL', label: 'Tous les postes' }, { code: 'NONE', label: 'Hors référentiel' }].map((t) => (
            <button
              key={t.code}
              onClick={() => { setScFilter(t.code); setSelectedCode(null); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${scFilter === t.code ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
              <span className="ml-1.5 opacity-70">
                ({jobCriteria.filter((j) => (t.code === 'ALL' ? true : t.code === 'NONE' ? !j.sous_commission : j.sous_commission === t.code)).length})
              </span>
            </button>
          ))}
          <button onClick={() => setCreatingSc(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-indigo-600 text-indigo-300 hover:bg-indigo-950/40 flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nouvelle sous-commission
          </button>
        </div>
        {creatingSc && <NouvelleSousCommission onCreate={handleCreateSc} onCancel={() => setCreatingSc(false)} />}
        {currentSc && !creatingSc && (
          <SousCommissionPanel
            sc={currentSc}
            all={sousCommissions}
            nbPostes={jobCriteria.filter((j) => j.sous_commission === currentSc.code).length}
            onSave={saveSousCommission}
            onDelete={handleDeleteSc}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Liste des postes */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3 lg:sticky lg:top-24">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un poste…" className={`${inputCls} pl-9 py-2`} />
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {list.map((j) => (
              <button
                key={j.code}
                onClick={() => setSelectedCode(j.code)}
                className={`w-full text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${selectedCode === j.code ? 'bg-indigo-950/80 border-indigo-500' : 'bg-slate-900/70 border-slate-700/60 hover:bg-slate-800'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white leading-snug">{j.job_title}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {j.a_confirmer && <span title="Compétences à valider par la sous-commission" className="w-2 h-2 rounded-full bg-amber-400" />}
                    {j.verrouille && <Lock className="w-3.5 h-3.5 text-rose-300" />}
                  </span>
                </div>
              </button>
            ))}
            {!list.length && <p className="text-xs text-slate-500 text-center py-4">Aucun poste.</p>}
          </div>
          <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-slate-700/60">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nouveau poste…" className={`${inputCls} py-2`} />
            <button type="submit" className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer" aria-label="Ajouter"><Plus className="w-4 h-4" /></button>
          </form>
        </div>

        {/* Éditeur */}
        {draft && selected && draft.code === selected.code ? (
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white">{selected.job_title}</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Version {selected.version} · {SOURCE_LABELS[selected.source] || selected.source} · {candidatsPoste} CV(s) importé(s)
                    {dirty && <span className="text-amber-300 font-bold"> · modifications non enregistrées</span>}
                  </p>
                </div>
                {locked && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-[11px] font-bold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Critères verrouillés
                  </span>
                )}
              </div>
              {selected.a_confirmer && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-[11px] text-amber-200">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Diplôme et expérience repris de l'avis ; les compétences ont été proposées faute de fiche de poste complète. À valider par la sous-commission avant verrouillage.
                  </span>
                  {!locked && (
                    <button onClick={() => handleSave({ a_confirmer: false })} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg cursor-pointer">
                      Valider la fiche
                    </button>
                  )}
                </div>
              )}
            </div>

            <fieldset disabled={locked} className="space-y-5">
              {/* Sous-commission de rattachement (§10) */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <label className="text-[11px] font-semibold text-slate-300">Sous-commission (§10)</label>
                <select className={`${inputCls} md:w-auto flex-1`} value={draft.sous_commission || ''} onChange={(e) => set({ sous_commission: e.target.value || null })}>
                  <option value="">— Hors référentiel —</option>
                  {sousCommissions.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.libelle}</option>)}
                </select>
              </div>

              {/* 2. Profil proposé */}
              <Card icon={GraduationCap} title="Profil proposé — diplôme et expérience" color="text-sky-400">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Niveau d'études minimum">
                    <select className={inputCls} value={draft.min_education_rank} onChange={(e) => set({ min_education_rank: Number(e.target.value) })}>
                      {(referentiel?.niveaux || []).map((n) => <option key={n.rank} value={n.rank}>{n.label}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expérience minimale (ans)" hint="0 = aucune exigence">
                      <input type="number" min="0" max="40" className={inputCls} value={draft.min_experience_years ?? 0} onChange={(e) => set({ min_experience_years: Number(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Expérience maximale (ans)" hint="Indicatif, non éliminatoire">
                      <input type="number" min="0" max="40" className={inputCls} value={draft.max_experience_years ?? ''} onChange={(e) => set({ max_experience_years: e.target.value === '' ? null : Number(e.target.value) })} />
                    </Field>
                  </div>
                  <Field label="Domaines de formation attendus" hint="Recherchés en priorité dans la section « Formation » du CV." className="md:col-span-2">
                    <TagInput value={draft.diplome_domaines || []} disabled={locked} onChange={(v) => set({ diplome_domaines: v })} tone="emerald" />
                  </Field>
                  <Field label="Domaines d'expérience pertinente" hint="Servent à calculer l'expérience « directement liée au poste » (critère de départage §17)." className="md:col-span-2">
                    <TagInput value={draft.experience_domaines || []} disabled={locked} onChange={(v) => set({ experience_domaines: v })} tone="emerald" />
                  </Field>
                </div>
              </Card>

              {/* 3. Compétences techniques */}
              <Card icon={Wrench} title={`Compétences techniques (${(draft.competences_techniques || []).length})`} color="text-amber-400">
                <CompetenceEditor items={draft.competences_techniques || []} disabled={locked} onChange={(v) => set({ competences_techniques: v })} />
              </Card>

              {/* 5. Langues */}
              <Card icon={Languages} title="Langues exigées" color="text-teal-400">
                <LanguesExigees
                  langues={referentiel?.langues || []}
                  selected={draft.langues_requises || []}
                  disabled={locked}
                  onToggle={(code) => {
                    const cur = draft.langues_requises || [];
                    set({ langues_requises: cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code] });
                  }}
                  onAdded={(code) => code && setDraft((d) => ({ ...d, langues_requises: Array.from(new Set([...(d.langues_requises || []), code])) }))}
                  onSave={saveLangue}
                  onDelete={deleteLangue}
                />
                <p className="text-[10px] text-slate-500">Le français est considéré comme acquis lorsque le CV est rédigé en français. Cliquez sur une langue pour l'exiger ou non ; le crayon modifie ses termes de détection, la corbeille la supprime de la plateforme.</p>
              </Card>

              {/* 6. Règles d'élimination */}
              <Card icon={ShieldAlert} title="Conditions de recevabilité et règles d'élimination (§7, §14)" color="text-rose-400">
                <Field label="Nationalités éligibles" hint="Un candidat d'une autre nationalité est non recevable (règle « nationalité » ci-dessous).">
                  <div className="flex flex-wrap gap-2">
                    {(countries.length ? countries.map((c) => c.name) : referentiel?.pays || []).map((p) => {
                      const on = (draft.nationalites_eligibles || []).includes(p);
                      return (
                        <button type="button" key={p}
                          onClick={() => set({ nationalites_eligibles: on ? draft.nationalites_eligibles.filter((x) => x !== p) : [...(draft.nationalites_eligibles || []), p] })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${on ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <div className="space-y-2">
                  {Object.entries(regles).map(([key, r]) => (
                    <div key={key} className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-700/60 rounded-xl p-2.5">
                      <label className="flex items-center gap-2 flex-1 min-w-[220px] text-xs text-slate-200 cursor-pointer">
                        <input type="checkbox" checked={!!r.actif} onChange={(e) => setRegle(key, { actif: e.target.checked })} className="accent-rose-500" />
                        {r.libelle}
                      </label>
                      {'valeur' in r && (
                        <input type="number" value={r.valeur} onChange={(e) => setRegle(key, { valeur: Number(e.target.value) })}
                          className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" title="Valeur" />
                      )}
                      {'tolerance' in r && (
                        <label className="text-[10px] text-slate-400 flex items-center gap-1">
                          Tolérance
                          <input type="number" min="0" max="5" value={r.tolerance} onChange={(e) => setRegle(key, { tolerance: Number(e.target.value) })}
                            className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" /> an(s)
                        </label>
                      )}
                      <select value={r.mode} onChange={(e) => setRegle(key, { mode: e.target.value })}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white">
                        <option value="eliminer">Éliminatoire</option>
                        <option value="verifier">À vérifier (signalement)</option>
                      </select>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  Lorsqu'une information n'est pas trouvée dans le CV (diplôme non identifiable, expérience non datée), le dossier est signalé « à vérifier » au lieu d'être éliminé, pour éviter d'écarter un candidat à tort.
                </p>
                <ReglesForm
                  regles={reglesPerso}
                  job={selected}
                  sousCommissions={sousCommissions}
                  langues={referentiel?.langues || []}
                  niveaux={referentiel?.niveaux || []}
                  types={referentiel?.regleTypes || {}}
                  onSave={saveRegle}
                  onDelete={deleteRegle}
                  disabled={locked}
                />
              </Card>

              {/* 7. Seuils & pondérations */}
              <Card icon={Gauge} title="Seuils de validation, convocation et pondérations" color="text-violet-400">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Seuil « Présélectionné » (/100)" hint="§14 : 70 et plus">
                    <input type="number" min="0" max="100" className={inputCls} value={seuils.propose} onChange={(e) => set({ seuils: { ...seuils, propose: Number(e.target.value) } })} />
                  </Field>
                  <Field label="Seuil « Liste de réserve » (/100)" hint="§14 : 60 à 69,99 · en dessous : non retenu">
                    <input type="number" min="0" max="100" className={inputCls} value={seuils.reserve} onChange={(e) => set({ seuils: { ...seuils, reserve: Number(e.target.value) } })} />
                  </Field>
                  <Field label="Nombre maximal de convoqués" hint="§12 : fixé avant l'examen des dossiers. Utilisé par le filtre « Selon le poste » du tableau de bord.">
                    <input type="number" min="0" className={inputCls} value={draft.max_convoques ?? ''} placeholder="Illimité" onChange={(e) => set({ max_convoques: e.target.value === '' ? null : Number(e.target.value) })} />
                  </Field>
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={customPond}
                      onChange={(e) => set({ ponderations: e.target.checked ? clone(scOfDraft?.ponderations || ponderations) : null })} className="accent-violet-500" />
                    Pondérations spécifiques à ce poste {!customPond && <span className="text-slate-500">(sinon : celles de la sous-commission {draft.sous_commission || '—'})</span>}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(PONDERATION_LABELS).map(([k, label]) => (
                      <label key={k} className="text-[10px] text-slate-400 flex flex-col gap-1">
                        {label}
                        <input type="number" min="0" max="100" disabled={!customPond || locked} value={ponderations[k] ?? 0}
                          onChange={(e) => set({ ponderations: { ...ponderations, [k]: Number(e.target.value) } })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs disabled:opacity-50" />
                      </label>
                    ))}
                  </div>
                  <p className={`text-[11px] font-bold ${Math.round(sumOf(ponderations)) === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Total : {sumOf(ponderations)}/100
                  </p>
                </div>
              </Card>
            </fieldset>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sticky bottom-3">
              {!locked && (
                <button onClick={handleDelete} className="mr-auto px-3 py-2 text-rose-300 hover:bg-rose-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              )}
              {referentiel?.postesOfficiels?.includes(selected.code) && !locked && (
                <button onClick={handleRestore} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <RotateCcw className="w-4 h-4" /> Fiche officielle
                </button>
              )}
              <button onClick={() => handleReevaluate(false)} disabled={busy || !candidatsPoste}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Réévaluer les {candidatsPoste} CV(s)
              </button>
              <button onClick={handleLock} className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${locked ? 'bg-rose-900 hover:bg-rose-800 text-rose-100' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                {locked ? <><Unlock className="w-4 h-4" /> Déverrouiller</> : <><Lock className="w-4 h-4" /> Verrouiller</>}
              </button>
              {!locked && (
                <button onClick={() => handleSave()} disabled={busy || !dirty}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-12 text-center text-slate-400 text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" /> Sélectionnez un poste pour afficher ses critères.
          </div>
        )}
      </div>

      {/* Pays de recrutement */}
      <CountriesForm
        countries={countries}
        onToggle={toggleCountry}
        onAdd={addCountry}
        onRemove={removeCountry}
        onUpdateNationalites={updateCountryNationalites}
      />
    </div>
  );
};

export default ConfigurationPage;
