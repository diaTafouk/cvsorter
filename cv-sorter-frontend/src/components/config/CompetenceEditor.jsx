import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { TagInput } from './TagInput';

/**
 * Éditeur d'une liste de compétences de fiche de poste.
 * Chaque compétence = libellé + mots-clés recherchés dans le CV + obligatoire + poids.
 */
export const CompetenceEditor = ({ items = [], onChange, disabled, tone = 'indigo', allowObligatoire = true }) => {
  const [open, setOpen] = useState(null);

  const update = (i, patch) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(items.filter((_, k) => k !== i));
  const add = () => {
    onChange([...items, { label: 'Nouvelle compétence', keywords: [], obligatoire: false, poids: 1 }]);
    setOpen(items.length);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-[11px] text-slate-500 italic">Aucune compétence définie pour ce poste.</p>
      )}
      {items.map((it, i) => {
        const isOpen = open === i;
        const missingKw = !it.keywords || it.keywords.length === 0;
        return (
          <div key={i} className={`rounded-xl border ${missingKw ? 'border-rose-700/70' : 'border-slate-700/70'} bg-slate-900/60`}>
            <div className="flex items-center gap-2 p-2.5">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Déplier">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <input
                value={it.label}
                disabled={disabled}
                onChange={(e) => update(i, { label: e.target.value })}
                className="flex-1 bg-transparent text-xs text-white font-semibold outline-none border-b border-transparent focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 whitespace-nowrap">{(it.keywords || []).length} mot(s)-clé(s)</span>
              {allowObligatoire && (
                <label className="flex items-center gap-1 text-[10px] text-amber-300 font-bold whitespace-nowrap cursor-pointer">
                  <input type="checkbox" disabled={disabled} checked={!!it.obligatoire} onChange={(e) => update(i, { obligatoire: e.target.checked })} className="accent-amber-500" />
                  Obligatoire
                </label>
              )}
              <label className="flex items-center gap-1 text-[10px] text-slate-400 whitespace-nowrap">
                Poids
                <input
                  type="number" min="1" max="5" disabled={disabled}
                  value={it.poids ?? 1}
                  onChange={(e) => update(i, { poids: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
                  className="w-11 bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-white text-[11px]"
                />
              </label>
              {!disabled && (
                <button type="button" onClick={() => remove(i)} className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer" aria-label="Supprimer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                <p className="text-[10px] text-slate-400">
                  Mots-clés recherchés dans le CV (accents et pluriels ignorés). La compétence est validée si au moins un mot-clé est trouvé.
                </p>
                <TagInput value={it.keywords || []} disabled={disabled} tone={tone} onChange={(kw) => update(i, { keywords: kw })} placeholder="Ex : audit interne, contrôle interne…" />
              </div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <button type="button" onClick={add} className="text-xs font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Ajouter une compétence
        </button>
      )}
    </div>
  );
};

export default CompetenceEditor;
