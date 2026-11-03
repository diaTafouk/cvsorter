import React, { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { TagInput } from './TagInput';

/**
 * Section « Langues exigées » d'un poste :
 *  - cocher / décocher les langues exigées pour le poste ;
 *  - ajouter une langue (elle est aussitôt exigée pour ce poste) ;
 *  - modifier ses termes de détection ou la supprimer.
 */
export const LanguesExigees = ({ langues = [], selected = [], onToggle, onSave, onDelete, onAdded, disabled }) => {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [synonymes, setSynonymes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);

  const flash = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 6000); };

  const add = async (e) => {
    e.preventDefault();
    if (!label.trim()) return flash('error', 'Indiquez le nom de la langue.');
    if (langues.some((l) => l.label.toLowerCase() === label.trim().toLowerCase())) return flash('error', 'Cette langue existe déjà.');
    const r = await onSave({ label: label.trim(), synonymes: synonymes.length ? synonymes : [label.trim()] });
    if (r?.ok === false) return flash('error', r.error);
    onAdded?.(r.langue?.code);
    flash('success', `« ${label.trim()} » ajoutée et cochée pour ce poste (pensez à enregistrer le poste).`);
    setLabel(''); setSynonymes([]); setAdding(false);
  };

  const remove = async (l) => {
    if (!window.confirm(`Supprimer la langue « ${l.label} » de la plateforme ?`)) return;
    let r = await onDelete(l, false);
    if (r?.ok === false && r.status === 409) {
      const postes = r.postes || [];
      const regles = r.regles || [];
      const detail = [
        postes.length ? `Postes : ${postes.slice(0, 8).join(', ')}${postes.length > 8 ? '…' : ''}` : '',
        regles.length ? `Règles : ${regles.join(', ')}` : ''
      ].filter(Boolean).join('\n');
      if (!window.confirm(`${r.error}\n\n${detail}\n\nLa retirer de ces postes (et supprimer ces règles), puis la supprimer ?`)) return;
      r = await onDelete(l, true);
    }
    if (r?.ok === false) flash('error', r.error);
    else flash('success', `Langue « ${l.label} » supprimée${r?.postesModifies ? ` et retirée de ${r.postesModifies} poste(s)` : ''}.`);
  };

  const inputCls = 'bg-slate-900 border border-slate-700 text-xs text-white p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {langues.map((l) => {
          const on = selected.includes(l.code);
          return (
            <span key={l.code} className={`inline-flex items-center rounded-xl border text-xs font-bold ${on ? 'bg-teal-950/80 border-teal-600 text-teal-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
              <button type="button" onClick={() => onToggle(l.code)} className="px-3 py-1.5 cursor-pointer" title={`Termes recherchés : ${(l.synonymes || []).join(', ')}`}>
                {l.label}
              </button>
              {!disabled && (
                <>
                  <button type="button" onClick={() => setEditing(editing === l.code ? null : l.code)} className="pr-1 opacity-60 hover:opacity-100 cursor-pointer" aria-label={`Modifier ${l.label}`}>
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => remove(l)} className="pr-2 pl-1 opacity-60 hover:opacity-100 hover:text-rose-400 cursor-pointer" aria-label={`Supprimer ${l.label}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </span>
          );
        })}
        {!disabled && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-xl border border-dashed border-teal-700 text-teal-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-teal-950/40">
            <Plus className="w-3.5 h-3.5" /> Ajouter une langue
          </button>
        )}
      </div>

      {editing && (() => {
        const l = langues.find((x) => x.code === editing);
        if (!l) return null;
        return (
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-1.5">
            <p className="text-[11px] text-slate-300">Termes recherchés dans le CV pour <b>{l.label}</b> (variantes d'écriture) :</p>
            <TagInput value={l.synonymes || []} tone="emerald" onChange={async (v) => { const r = await onSave({ code: l.code, label: l.label, synonymes: v }); if (r?.ok === false) flash('error', r.error); }} />
            <button type="button" onClick={() => setEditing(null)} className="text-[11px] text-slate-400 hover:text-white cursor-pointer">Fermer</button>
          </div>
        );
      })()}

      {adding && (
        <form onSubmit={add} className="rounded-xl border border-teal-800 bg-teal-950/20 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2">
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom de la langue (ex : Soninké)" className={inputCls} />
            <TagInput value={synonymes} onChange={setSynonymes} tone="emerald" placeholder="Variantes d'écriture (ex : soninke, sarakole) puis Entrée" />
          </div>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setAdding(false); setLabel(''); setSynonymes([]); }} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Annuler</button>
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> Ajouter la langue</button>
          </div>
        </form>
      )}

      {message && <p className={`text-[11px] font-bold ${message.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{message.text}</p>}
    </div>
  );
};

export default LanguesExigees;
