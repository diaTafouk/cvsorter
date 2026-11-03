import React, { useState } from 'react';
import { Globe, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';
import { TagInput } from './TagInput';

/**
 * Formulaire de sélection des pays de recrutement (table pays).
 * Un pays désactivé n'est plus proposé dans l'Espace Candidat.
 */
export const CountriesForm = ({ countries = [], onToggle, onAdd, onRemove, onUpdateNationalites }) => {
  const [nom, setNom] = useState('');
  const [nationalites, setNationalites] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!nom.trim()) return setError('Indiquez le nom du pays.');
    if (countries.some((c) => c.name.toLowerCase() === nom.trim().toLowerCase())) return setError('Ce pays existe déjà.');
    const r = await onAdd(nom.trim(), nationalites);
    if (r?.ok === false) return setError(r.error);
    setNom('');
    setNationalites([]);
  };

  return (
    <section className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 pb-2.5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" /> Pays de recrutement
        </h3>
        <span className="text-[11px] text-slate-400">{countries.filter((c) => c.active).length} actif(s) sur {countries.length}</span>
      </div>

      <p className="text-[11px] text-slate-400">
        Cochez les pays ouverts au recrutement. Seuls les pays actifs sont proposés dans l'Espace Candidat. Les termes de nationalité
        servent à reconnaître la nationalité écrite dans le CV (ex. : « malien, malienne »).
      </p>

      <div className="space-y-2">
        {countries.map((c) => (
          <div key={c.name} className={`rounded-xl border ${c.active ? 'border-emerald-700/70 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/60'}`}>
            <div className="flex flex-wrap items-center gap-3 p-3">
              <button type="button" onClick={() => onToggle(c.name)} className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                {c.active ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />}
                {c.name}
              </button>
              <span className={`text-[10px] px-2 py-0.5 rounded ${c.active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                {c.active ? 'Actif' : 'Inactif'}
              </span>
              <button type="button" onClick={() => setOpen(open === c.name ? null : c.name)} className="text-[11px] text-indigo-300 hover:text-indigo-200 cursor-pointer">
                Nationalité : {(c.nationalites || []).join(', ') || 'non renseignée'}
              </button>
              <button type="button" onClick={() => { if (window.confirm(`Retirer « ${c.name} » de la liste des pays ?`)) onRemove(c.name); }}
                className="ml-auto p-1 text-slate-500 hover:text-rose-400 cursor-pointer" aria-label={`Supprimer ${c.name}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {open === c.name && (
              <div className="px-3 pb-3">
                <TagInput value={c.nationalites || []} onChange={(v) => onUpdateNationalites(c.name, v)} tone="emerald" placeholder="Ex : malien, malienne" />
              </div>
            )}
          </div>
        ))}
        {!countries.length && <p className="text-xs text-slate-500">Aucun pays enregistré.</p>}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-start pt-2 border-t border-slate-700/60">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nouveau pays…"
          className="bg-slate-900 border border-slate-700 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <TagInput value={nationalites} onChange={setNationalites} tone="emerald" placeholder="Termes de nationalité (Entrée pour ajouter)" />
        <button type="submit" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </form>
      {error && <p className="text-[11px] text-rose-400 font-bold">{error}</p>}
    </section>
  );
};

export default CountriesForm;
