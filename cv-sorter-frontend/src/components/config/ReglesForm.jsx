import React, { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { TagInput } from './TagInput';

const CRITERES = { diplome: 'Diplôme', experience: 'Expérience', techniques: 'Compétences techniques', langues: 'Langues' };
const EMPTY = { libelle: '', type: 'mot_cle_requis', valeurs: [], valeur: '', mode: 'eliminer', portee: '' };

/**
 * Conditions de recevabilité et règles d'élimination ajoutées par la Commission.
 * Portée : ce poste, sa sous-commission ou tous les postes. Enregistrées immédiatement (table regles_personnalisees).
 */
export const ReglesForm = ({ regles = [], job, sousCommissions = [], langues = [], niveaux = [], types = {}, onSave, onDelete, disabled }) => {
  const posteKey = `poste:${job.code}`;
  const applicables = regles.filter((r) => r.portee === 'tous' || r.portee === posteKey || (job.sous_commission && r.portee === job.sous_commission));
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  const porteeLabel = (p) => {
    if (p === 'tous') return 'Tous les postes';
    if (p === posteKey) return 'Ce poste';
    const sc = sousCommissions.find((s) => s.code === p);
    return sc ? `Sous-commission ${sc.code}` : p;
  };
  const describe = (r) => {
    const t = types[r.type];
    if (!t) return r.type;
    if (t.besoin === 'valeurs') return `${t.label} : ${(r.valeurs || []).join(', ')}`;
    if (t.besoin === 'langue') return `${t.label} : ${(r.valeurs || []).map((c) => langues.find((l) => l.code === c)?.label || c).join(', ')}`;
    if (t.besoin === 'niveau') return `${t.label} : ${niveaux.find((n) => n.rank === Number(r.valeur))?.label || r.valeur}`;
    if (t.besoin === 'critere') return `${CRITERES[(r.valeurs || [])[0]] || '?'} ≥ ${r.valeur}/100`;
    return `${t.label} : ${r.valeur}`;
  };

  const start = (r) => { setError(null); setForm(r ? { ...r, valeur: r.valeur ?? '' } : { ...EMPTY, portee: posteKey }); };
  const besoin = form ? types[form.type]?.besoin : null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = { ...form, libelle: form.libelle.trim() || types[form.type]?.label };
    const res = await onSave(payload);
    if (res?.ok === false) setError(res.error);
    else setForm(null);
  };

  const inputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white';

  return (
    <div className="space-y-2 pt-3 border-t border-slate-700/60">
      <p className="text-[11px] font-bold text-slate-300">Conditions et règles ajoutées par la Commission</p>
      {applicables.length === 0 && <p className="text-[11px] text-slate-500 italic">Aucune règle supplémentaire pour ce poste.</p>}
      {applicables.map((r) => (
        <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-xs ${r.actif ? 'border-rose-900/70 bg-rose-950/20' : 'border-slate-700 bg-slate-900/40 opacity-60'}`}>
          <span className="font-bold text-white">{r.libelle}</span>
          <span className="text-slate-400">— {describe(r)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.mode === 'eliminer' ? 'bg-rose-950 text-rose-300' : 'bg-orange-950 text-orange-300'}`}>{r.mode === 'eliminer' ? 'Éliminatoire' : 'À vérifier'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{porteeLabel(r.portee)}</span>
          {!disabled && (
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => onSave({ ...r, actif: !r.actif })} className="text-[10px] text-slate-300 hover:text-white px-1.5 cursor-pointer">{r.actif ? 'Désactiver' : 'Activer'}</button>
              <button type="button" onClick={() => start(r)} className="p-1 text-slate-400 hover:text-white cursor-pointer" aria-label="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => { if (window.confirm(`Supprimer la règle « ${r.libelle} » ?`)) onDelete(r); }} className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer" aria-label="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </div>
      ))}

      {form ? (
        <form onSubmit={submit} className="rounded-xl border border-indigo-700/70 bg-indigo-950/20 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400 flex flex-col gap-1">Type de condition
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, valeurs: [], valeur: '' })}>
                {Object.entries(types).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-slate-400 flex flex-col gap-1">Libellé (affiché dans les motifs)
              <input className={inputCls} value={form.libelle} placeholder={types[form.type]?.label} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
            </label>
          </div>

          {besoin === 'valeurs' && (
            <TagInput value={form.valeurs} onChange={(v) => setForm({ ...form, valeurs: v })} placeholder={`Ex : ${types[form.type]?.exemple}`} />
          )}
          {besoin === 'valeur' && (
            <input type="number" min="0" className={`${inputCls} w-32`} value={form.valeur} placeholder={types[form.type]?.exemple} onChange={(e) => setForm({ ...form, valeur: e.target.value })} />
          )}
          {besoin === 'niveau' && (
            <select className={inputCls} value={form.valeur} onChange={(e) => setForm({ ...form, valeur: e.target.value })}>
              <option value="">— Niveau —</option>
              {niveaux.map((n) => <option key={n.rank} value={n.rank}>{n.label}</option>)}
            </select>
          )}
          {besoin === 'langue' && (
            <select className={inputCls} value={form.valeurs[0] || ''} onChange={(e) => setForm({ ...form, valeurs: e.target.value ? [e.target.value] : [] })}>
              <option value="">— Langue —</option>
              {langues.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          )}
          {besoin === 'critere' && (
            <div className="flex flex-wrap gap-2 items-center">
              <select className={inputCls} value={form.valeurs[0] || ''} onChange={(e) => setForm({ ...form, valeurs: e.target.value ? [e.target.value] : [] })}>
                <option value="">— Critère —</option>
                {Object.entries(CRITERES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="text-slate-400 text-xs">≥</span>
              <input type="number" min="0" max="100" className={`${inputCls} w-24`} value={form.valeur} onChange={(e) => setForm({ ...form, valeur: e.target.value })} />
              <span className="text-slate-400 text-xs">/100</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="eliminer">Éliminatoire (non recevable)</option>
              <option value="verifier">À vérifier (signalement)</option>
            </select>
            <select className={inputCls} value={form.portee} onChange={(e) => setForm({ ...form, portee: e.target.value })}>
              <option value={posteKey}>S'applique à : ce poste</option>
              {job.sous_commission && <option value={job.sous_commission}>S'applique à : sous-commission {job.sous_commission}</option>}
              <option value="tous">S'applique à : tous les postes</option>
            </select>
            <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => setForm(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Annuler</button>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> Enregistrer la règle</button>
            </span>
          </div>
          {error && <p className="text-[11px] text-rose-400 font-bold">{error}</p>}
        </form>
      ) : (
        !disabled && (
          <button type="button" onClick={() => start(null)} className="text-xs font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Ajouter une condition de recevabilité / règle d'élimination
          </button>
        )
      )}
      <p className="text-[10px] text-slate-500">Les règles sont enregistrées immédiatement. Cliquez ensuite sur « Réévaluer » pour les appliquer aux CV déjà importés.</p>
    </div>
  );
};

export default ReglesForm;
