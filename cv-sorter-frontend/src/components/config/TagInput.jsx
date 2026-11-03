import React, { useState } from 'react';
import { X } from 'lucide-react';

/** Saisie de mots-clés : Entrée ou virgule pour ajouter, × pour retirer */
export const TagInput = ({ value = [], onChange, placeholder = 'Ajouter puis Entrée…', disabled, tone = 'indigo' }) => {
  const [text, setText] = useState('');
  const tones = {
    indigo: 'bg-indigo-950/70 border-indigo-800/70 text-indigo-200',
    emerald: 'bg-emerald-950/70 border-emerald-800/70 text-emerald-200',
    amber: 'bg-amber-950/60 border-amber-800/70 text-amber-200'
  };

  const add = (raw) => {
    const items = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...value];
    for (const it of items) if (!next.some((v) => v.toLowerCase() === it.toLowerCase())) next.push(it);
    onChange(next);
    setText('');
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-2 min-h-[42px] ${disabled ? 'opacity-60' : ''}`}>
      {value.map((tag) => (
        <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium ${tones[tone]}`}>
          {tag}
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} className="hover:text-rose-300 cursor-pointer" aria-label={`Retirer ${tag}`}>
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={text}
          onChange={(e) => {
            if (e.target.value.endsWith(',')) add(e.target.value);
            else setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-xs text-white outline-none px-1 py-0.5"
        />
      )}
    </div>
  );
};

export default TagInput;
