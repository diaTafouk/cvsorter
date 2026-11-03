import React, { useEffect } from 'react';
import { X, Printer, CheckCircle, AlertTriangle, FileText, Ban, XCircle, GraduationCap, Briefcase, Languages, ListOrdered, ExternalLink, Download } from 'lucide-react';

const DECISION_STYLES = {
  'Présélectionné': 'bg-emerald-900/70 text-emerald-200 border-emerald-700',
  'Liste de réserve': 'bg-amber-900/70 text-amber-200 border-amber-700',
  'Non retenu': 'bg-slate-800 text-slate-200 border-slate-600',
  'Non recevable': 'bg-rose-900/70 text-rose-200 border-rose-700'
};
const BREAKDOWN_LABELS = {
  diplome: 'Diplôme',
  experience: 'Expérience',
  techniques: 'Compétences techniques',
  langues: 'Langues',
  // ancien format
  skills: 'Compétences', education: 'Formation', languages: 'Langues'
};

const Section = ({ title, icon: Icon, children }) => (
  <div className="space-y-2">
    <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-indigo-400" />} {title}
    </h3>
    {children}
  </div>
);

const CompList = ({ items }) => (
  <ul className="space-y-1">
    {items.map((it, i) => (
      <li key={i} className="flex items-start gap-2 text-xs">
        {it.trouve ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />}
        <span className={it.trouve ? 'text-slate-200' : 'text-slate-500'}>
          {it.label}
          {it.obligatoire && <span className="ml-1 text-[9px] font-bold text-amber-400 uppercase">obligatoire</span>}
          {it.trouve && it.preuve && <span className="block text-[10px] text-slate-500 italic">« …{it.preuve}… »</span>}
        </span>
      </li>
    ))}
  </ul>
);

// Libellé du format d'origine du CV
const formatLabel = (c) => {
  const ext = (c.format || (c.fileName || '').split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'docx' || ext === 'doc') return 'Word';
  if (['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp'].includes(ext)) return 'photo';
  return ext ? ext.toUpperCase() : 'fichier';
};

/** Ouvre le CV tel qu'il a été importé (PDF / photo : nouvel onglet ; Word : ouvert par Word) */
const OpenCvButtons = ({ candidate }) => {
  const url = `/api/candidates/${encodeURIComponent(candidate.id)}/file`;
  const fmt = formatLabel(candidate);
  if (candidate.has_file === false) {
    return (
      <span title="Ce CV a été importé avant la conservation des fichiers : réimportez-le pour pouvoir l'ouvrir."
        className="px-3 py-2 text-slate-500 bg-slate-800/60 border border-slate-700 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-not-allowed">
        <FileText className="w-4 h-4" /> CV original indisponible
      </span>
    );
  }
  return (
    <div className="flex items-center">
      <a href={url} target="_blank" rel="noopener noreferrer"
        title={fmt === 'Word' ? 'Le fichier Word se télécharge et s’ouvre avec Word' : `Ouvrir le CV (${fmt}) dans un nouvel onglet`}
        className="px-3 py-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-l-xl transition flex items-center gap-1.5 text-xs font-bold shadow-lg">
        <ExternalLink className="w-4 h-4" /> Ouvrir le CV ({fmt})
      </a>
      <a href={`${url}?download=1`} download={candidate.fileName || undefined} title="Télécharger le fichier original"
        className="px-2.5 py-2 text-white bg-emerald-700 hover:bg-emerald-600 rounded-r-xl border-l border-emerald-500/50 transition flex items-center" aria-label="Télécharger le CV">
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
};

export const CandidateDetailModal = ({ candidate, onClose }) => {
  // Fermeture par la touche Échap + blocage du défilement de la page en arrière-plan
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!candidate) return null;

  let e = {};
  try {
    e = (typeof candidate.evaluation === 'string' ? JSON.parse(candidate.evaluation) : candidate.evaluation) || {};
  } catch { e = {}; }

  const name = (candidate.name || '').replace(/^\s*(cv|curriculum vitae)\s+/i, '').trim()
    || (candidate.fileName ? candidate.fileName.replace(/\.[^/.]+$/, '') : 'Candidat');
  const decision = e.decision || e.status || candidate.status || '—';
  const d = e.details || {};
  const breakdown = e.breakdown || {};
  const pond = e.ponderations || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="min-h-full flex items-start justify-center p-4 sm:py-10">
      <div id="print-modal-content" onClick={(ev) => ev.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl text-slate-100 relative">
        {/* En-tête fixe : reste visible pendant le défilement, avec le bouton Fermer */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur rounded-t-2xl flex justify-between items-start gap-4 border-b border-slate-700/80 p-6 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{name}</h2>
            <p className="text-xs text-slate-300 font-medium mt-1">
              {candidate.job_title} • {candidate.country || '—'}
              {candidate.email && ` • ${candidate.email}`}{candidate.phone && ` • ${candidate.phone}`}
            </p>
            {e.criteres && (
              <p className="text-[10px] text-slate-500 mt-1">
                Sous-commission {e.criteres.sous_commission || '—'} {e.criteres.sous_commission_libelle && `(${e.criteres.sous_commission_libelle})`} ·
                critères v{e.criteres.version} · évalué le {e.evaluatedAt ? new Date(e.evaluatedAt).toLocaleString('fr-FR') : '—'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end items-center gap-3 no-print">
            <OpenCvButtons candidate={candidate} />
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-bold shadow-lg">
              <Printer className="w-4 h-4" /> Imprimer la fiche
            </button>
            <button onClick={onClose} className="px-3 py-2 text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold" aria-label="Fermer">
              <X className="w-4 h-4" /> Fermer
            </button>
          </div>
        </div>

        <div className="p-6 pt-5 space-y-6">
        {/* Score + décision */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-950/40 border border-indigo-800/50 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <div className="text-3xl font-black text-indigo-300">{e.score ?? 0}<span className="text-base text-indigo-500">/100</span></div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">Note de présélection</p>
            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${DECISION_STYLES[decision] || 'bg-slate-800 border-slate-600'}`}>{decision}</span>
            {candidate.rang && (
              <span className="text-[11px] text-slate-300 flex items-center gap-1">
                <ListOrdered className="w-3.5 h-3.5" /> Rang {candidate.rang} / {candidate.rangTotal}{candidate.exAequo ? ' (ex æquo)' : ''}{candidate.convoque ? ' · convoqué' : ''}
              </span>
            )}
            {e.seuils && <span className="text-[10px] text-slate-500">Seuils : ≥ {e.seuils.propose} présélection · ≥ {e.seuils.reserve} réserve</span>}
          </div>

          <div className="md:col-span-2 bg-slate-800/40 border border-slate-700/60 p-4 rounded-2xl space-y-2.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Grille de présélection</h3>
            {Object.entries(breakdown).filter(([k]) => k !== 'comportementales').map(([k, v]) => (
              <div key={k} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">{BREAKDOWN_LABELS[k] || k}{pond[k] != null && <span className="text-slate-500"> · pondération {pond[k]}</span>}</span>
                  <span className="font-bold text-white">{v}/100</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${v >= 70 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {candidate.departageMotif && <p className="text-[11px] text-sky-300 bg-sky-950/30 border border-sky-900 rounded-xl p-2.5">{candidate.departageMotif}</p>}

        {/* Éliminations & vérifications */}
        {(e.eliminations?.length > 0 || e.verifications?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {e.eliminations?.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-800/60 p-4 rounded-2xl space-y-2">
                <h4 className="font-bold text-rose-300 flex items-center gap-2"><Ban className="w-4 h-4" /> Motifs de non-recevabilité</h4>
                <ul className="list-disc list-inside space-y-1 text-rose-100/90">{e.eliminations.map((x, i) => <li key={i}>{x.motif}</li>)}</ul>
              </div>
            )}
            {e.verifications?.length > 0 && (
              <div className="bg-orange-950/30 border border-orange-800/60 p-4 rounded-2xl space-y-2">
                <h4 className="font-bold text-orange-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> À vérifier par la sous-commission</h4>
                <ul className="list-disc list-inside space-y-1 text-orange-100/90">{e.verifications.map((x, i) => <li key={i}>{x.motif}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* Profil */}
        {e.details && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Formation" icon={GraduationCap}>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-xs space-y-1">
                <p><span className="text-slate-500">Diplôme détecté :</span> <b>{d.diplome?.detecte || 'non identifié'}</b>{d.diplome?.incomplet && ' (en cours / niveau)'}</p>
                <p><span className="text-slate-500">Minimum requis :</span> {d.diplome?.requis}</p>
                <p><span className="text-slate-500">Domaine :</span> {d.diplome?.domaine || 'non retrouvé'}</p>
                {d.diplome?.preuve && <p className="text-[10px] text-slate-500 italic">« {d.diplome.preuve} »</p>}
              </div>
            </Section>
            <Section title="Expérience professionnelle" icon={Briefcase}>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-xs space-y-1">
                <p>
                  <b>{d.experience?.annees ?? 0} an(s)</b> dont <b>{d.experience?.anneesPertinentes ?? 0}</b> dans le domaine
                  <span className="text-slate-500"> · requis : {d.experience?.requis || 0}{d.experience?.max ? ` à ${d.experience.max}` : ''} an(s)</span>
                </p>
                {d.experience?.stagesMois > 0 && <p className="text-slate-400">dont {d.experience.stagesMois} mois de stage(s)</p>}
                {d.experience?.approximatif && <p className="text-amber-300/90 text-[10px]">Périodes datées par l'année seule : durée estimée, à confirmer sur attestations.</p>}
                <ul className="space-y-1 max-h-40 overflow-y-auto pt-1">
                  {(d.experience?.periodes || []).map((p, i) => (
                    <li key={i} className={`text-[10px] ${p.pertinent ? 'text-emerald-300' : 'text-slate-300'}`}>
                      <b>{p.libelle || `${p.debut} → ${p.fin}`}</b> ({p.mois} mois){p.stage ? ' · stage' : ''}{p.pertinent ? ' · lié au poste' : ''} — {p.extrait}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
            <Section title="Compétences techniques (fiche de poste)">
              <CompList items={d.techniques || []} />
            </Section>
            <Section title="Langues" icon={Languages}>
              <div className="flex flex-wrap gap-1.5">
                {(d.langues || []).map((l) => (
                  <span key={l.code} className={`px-2 py-0.5 rounded-md text-[11px] border ${l.trouvee ? 'bg-teal-950/60 border-teal-800 text-teal-200' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {l.label}{l.requise ? ' (exigée)' : ''}{l.implicite ? ' · implicite' : ''}{!l.trouvee ? ' · absente' : ''}
                  </span>
                ))}
              </div>
            </Section>
            <Section title="État civil">
              <div className="text-xs text-slate-300 space-y-0.5">
                <p><span className="text-slate-500">Nationalité déclarée :</span> {d.paysDeclare || '—'}</p>
                <p><span className="text-slate-500">Nationalité dans le CV :</span> {d.nationalite?.pays || d.nationalite?.autre || 'non mentionnée'}</p>
                <p><span className="text-slate-500">Âge :</span> {d.age ? `${d.age.valeur} ans${d.age.approx ? ' (approx.)' : ''}` : 'non mentionné'}</p>
              </div>
            </Section>
          </div>
        )}

        {/* Note de décision */}
        <Section title="Note de décision">
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl text-xs text-slate-200 leading-relaxed">{e.summary || '—'}</div>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-2 border-b border-emerald-800/40 pb-2"><CheckCircle className="w-4 h-4" /> Points forts</h4>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">{(e.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-2xl space-y-2">
            <h4 className="font-bold text-rose-400 flex items-center gap-2 border-b border-rose-800/40 pb-2"><AlertTriangle className="w-4 h-4" /> Points d'attention</h4>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">{(e.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        </div>

        {candidate.extractedText && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-indigo-400" /> Extrait du CV analysé</h4>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-line">{candidate.extractedText}</div>
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default CandidateDetailModal;
