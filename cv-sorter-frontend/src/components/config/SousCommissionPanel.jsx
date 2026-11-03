import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Check } from 'lucide-react';

const PKEYS = { diplome: 'Diplôme', experience: 'Expérience', techniques: 'Compétences techniques', langues: 'Langues' };
const sumOf = (p) => Object.keys(PKEYS).reduce((a, k) => a + Number(p?.[k] || 0), 0);
const inputCls = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';

const PonderationsInputs = ({ value, onChange }) => (
  <div className="flex flex-wrap items-end gap-2">
    {Object.entries(PKEYS).map(([k, label]) => (
      <label key={k} className="text-[10px] text-slate-400 flex flex-col gap-1">
        {label}
        <input type="number" min="0" max="100" value={value?.[k] ?? 0} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} className={`${inputCls} w-24`} />
      </label>
    ))}
    <span className={`text-[11px] font-bold pb-2 ${Math.round(sumOf(value)) === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>Total {sumOf(value)}/100</span>
  </div>
);

/** Formulaire de création d'une sous-commission */
export const NouvelleSousCommission = ({ onCreate, onCancel }) => {
  const [form, setForm] = useState({ code: '', libelle: '', perimetre: '', ponderations: { diplome: 25, experience: 35, techniques: 35, langues: 5 } });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.libelle.trim()) return setError('Indiquez le libellé de la sous-commission.');
    if (Math.round(sumOf(form.ponderations)) !== 100) return setError('La somme des pondérations doit être égale à 100.');
    const r = await onCreate(form);
    if (r?.ok === false) setError(r.error);
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-indigo-700/70 bg-indigo-950/20 p-3 space-y-2">
      <p className="text-xs font-bold text-white">Nouvelle sous-commission</p>
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2">
        <input className={inputCls} value={form.code} maxLength={20} placeholder="Code (auto)" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input className={inputCls} value={form.libelle} placeholder="Libellé (ex : Communication et numérique)" onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
      </div>
      <textarea rows="2" className={`${inputCls} w-full`} value={form.perimetre} placeholder="Périmètre : métiers et fonctions couverts" onChange={(e) => setForm({ ...form, perimetre: e.target.value })} />
      <PonderationsInputs value={form.ponderations} onChange={(p) => setForm({ ...form, ponderations: p })} />
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Annuler</button>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> Créer</button>
      </div>
      {error && <p className="text-[11px] text-rose-400 font-bold">{error}</p>}
    </form>
  );
};

/** Détail d'une sous-commission : libellé, périmètre, pondérations, suppression */
export const SousCommissionPanel = ({ sc, all = [], nbPostes = 0, onSave, onDelete }) => {
  const init = (x) => ({ libelle: x.libelle, perimetre: x.perimetre || '', ponderations: { ...x.ponderations } });
  const [draft, setDraft] = useState(() => init(sc));
  const [deleting, setDeleting] = useState(false);
  const [reassign, setReassign] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setDraft(init(sc));
    setDeleting(false);
    setMsg(null);
    setReassign(all.find((s) => s.code !== sc.code)?.code || 'NONE');
  }, [sc.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return null;
  const dirty = draft.libelle !== sc.libelle || draft.perimetre !== (sc.perimetre || '') || JSON.stringify(draft.ponderations) !== JSON.stringify(sc.ponderations);
  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const save = async () => {
    if (Math.round(sumOf(draft.ponderations)) !== 100) return flash('error', 'La somme des pondérations doit être égale à 100.');
    const r = await onSave(sc.code, draft);
    flash(r?.ok === false ? 'error' : 'success', r?.ok === false ? r.error : 'Sous-commission enregistrée.');
  };
  const remove = async () => {
    const r = await onDelete(sc.code, nbPostes ? reassign : null);
    if (r?.ok === false) flash('error', r.error);
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold text-slate-500 flex flex-col gap-1">Libellé
            <input className={inputCls} value={draft.libelle} onChange={(e) => setDraft({ ...draft, libelle: e.target.value })} />
          </label>
          <label className="text-[10px] uppercase font-bold text-slate-500 flex flex-col gap-1">Périmètre (§10)
            <textarea rows="3" className={`${inputCls} normal-case font-normal`} value={draft.perimetre} onChange={(e) => setDraft({ ...draft, perimetre: e.target.value })} />
          </label>
        </div>
        <div className="lg:col-span-2 space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-500">Pondérations de présélection par défaut de la sous-commission</p>
          <PonderationsInputs value={draft.ponderations} onChange={(p) => setDraft({ ...draft, ponderations: p })} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={save} disabled={!dirty}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
            {!deleting ? (
              <button onClick={() => setDeleting(true)} className="ml-auto px-3 py-2 text-rose-300 hover:bg-rose-950 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer la sous-commission
              </button>
            ) : (
              <div className="ml-auto flex flex-wrap items-center gap-2 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2 text-[11px] text-rose-100">
                {nbPostes > 0 ? (
                  <>
                    <span>{nbPostes} poste(s) rattaché(s) : les déplacer vers</span>
                    <select className={inputCls} value={reassign} onChange={(e) => setReassign(e.target.value)}>
                      {all.filter((s) => s.code !== sc.code).map((s) => <option key={s.code} value={s.code}>{s.code} — {s.libelle}</option>)}
                      <option value="NONE">Hors référentiel</option>
                    </select>
                  </>
                ) : (
                  <span>Aucun poste rattaché. Confirmer la suppression ?</span>
                )}
                <button onClick={remove} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-md cursor-pointer">Supprimer</button>
                <button onClick={() => setDeleting(false)} className="px-2.5 py-1 bg-slate-700 text-white font-bold rounded-md cursor-pointer">Annuler</button>
              </div>
            )}
          </div>
          {deleting && <p className="text-[10px] text-slate-400">Les règles propres à cette sous-commission suivent ses postes ; si les postes passent hors référentiel, ces règles sont supprimées. Impossible si un poste rattaché est verrouillé.</p>}
          {msg && <p className={`text-[11px] font-bold ${msg.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
};

export default SousCommissionPanel;
