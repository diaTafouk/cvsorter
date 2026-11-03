import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AppContext = createContext(null);

const apiError = (err) => err?.response?.data?.error || err?.message || 'Erreur réseau';

export const AppProvider = ({ children }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Référentiel officiel (sous-commissions, niveaux, langues, règles, seuils) servi par le backend
  const [referentiel, setReferentiel] = useState(null);
  // Postes et critères de présélection stockés en base (table job_criteria)
  const [jobCriteria, setJobCriteria] = useState([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);

  // Pays de recrutement (table pays, gérée depuis la page Configuration)
  const [countries, setCountries] = useState([]);

  // Règles de recevabilité / d'élimination ajoutées par la Commission
  const [regles, setRegles] = useState([]);
  const fetchRegles = useCallback(async () => {
    try {
      const res = await axios.get('/api/regles');
      setRegles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erreur lors du chargement des règles:', err);
    }
  }, []);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await axios.get('/api/pays');
      setCountries((res.data || []).map((p) => ({ name: p.nom, active: p.actif, nationalites: p.nationalites || [] })));
    } catch (err) {
      console.error('Erreur lors du chargement des pays:', err);
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/candidates');
      setCandidates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erreur lors de la récupération des candidats:', err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCriteria = useCallback(async () => {
    setCriteriaLoading(true);
    try {
      const [ref, crit] = await Promise.all([axios.get('/api/referentiel'), axios.get('/api/criteria')]);
      setReferentiel(ref.data);
      setJobCriteria(Array.isArray(crit.data) ? crit.data : []);
    } catch (err) {
      console.error('Erreur lors du chargement des critères:', err);
    } finally {
      setCriteriaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
    fetchCriteria();
    fetchCountries();
    fetchRegles();
  }, [fetchCandidates, fetchCriteria, fetchCountries, fetchRegles]);

  const replaceJob = (job) =>
    setJobCriteria((prev) => {
      const exists = prev.some((j) => j.code === job.code);
      return exists ? prev.map((j) => (j.code === job.code ? job : j)) : [...prev, job];
    });

  /** Enregistre les critères d'un poste (nouvelle version + historique côté serveur) */
  const saveJob = async (job) => {
    try {
      const res = await axios.post('/api/criteria', job);
      replaceJob(res.data.criteria);
      return { ok: true, job: res.data.criteria };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  const addJob = async (title, sousCommission = null) =>
    saveJob({
      job_title: title,
      sous_commission: sousCommission,
      nombre_postes: 1,
      min_education_rank: 3,
      min_experience_years: 0,
      competences_techniques: [],
      competences_comportementales: [],
      langues_requises: ['francais'],
      nationalites_eligibles: ['Mali', 'Burkina Faso', 'Niger'],
      source: 'manuel'
    });

  const lockJob = async (job, verrouille) => {
    try {
      const res = await axios.post(`/api/criteria/${encodeURIComponent(job.ref || job.code)}/lock`, { verrouille });
      replaceJob(res.data.criteria);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  const restoreJob = async (job) => {
    try {
      const res = await axios.post(`/api/criteria/${encodeURIComponent(job.ref || job.code)}/restore`);
      replaceJob(res.data.criteria);
      return { ok: true, job: res.data.criteria };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  const deleteJob = async (job) => {
    try {
      await axios.delete(`/api/criteria/${encodeURIComponent(job.ref || job.code)}`);
      setJobCriteria((prev) => prev.filter((j) => j.code !== job.code));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  /** patch = { ponderations?, libelle?, perimetre? } (ancien appel : un objet de pondérations seul) */
  const saveSousCommission = async (code, patch) => {
    const body = patch && (patch.ponderations || patch.libelle !== undefined || patch.perimetre !== undefined) ? patch : { ponderations: patch };
    try {
      await axios.put(`/api/sous-commissions/${encodeURIComponent(code)}`, body);
      await fetchCriteria();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };
  const createSousCommission = async (sc) => {
    try {
      const res = await axios.post('/api/sous-commissions', sc);
      await fetchCriteria();
      return { ok: true, sousCommission: res.data?.sousCommission };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };
  /** reassign : code d'une autre sous-commission, 'NONE' (hors référentiel) ou null (refus si des postes y sont rattachés) */
  const deleteSousCommission = async (code, reassign = null) => {
    try {
      const res = await axios.delete(`/api/sous-commissions/${encodeURIComponent(code)}`, { params: reassign ? { reassign } : {} });
      await fetchCriteria();
      await fetchRegles();
      await fetchCandidates();
      return { ok: true, ...res.data };
    } catch (err) {
      return { ok: false, error: apiError(err), status: err?.response?.status, postes: err?.response?.data?.postes };
    }
  };

  /** Réévalue les CVs déjà importés avec les critères en vigueur */
  const reevaluate = async (jobTitle) => {
    try {
      const res = await axios.post('/api/candidates/reevaluate', jobTitle ? { jobTitle } : {});
      await fetchCandidates();
      return { ok: true, ...res.data };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  const savePays = async (pays) => {
    try {
      await axios.post('/api/pays', { nom: pays.name, actif: pays.active, nationalites: pays.nationalites });
      await fetchCountries();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };
  const toggleCountry = (countryName) => {
    const c = countries.find((x) => x.name === countryName);
    return c ? savePays({ ...c, active: !c.active }) : null;
  };
  const addCountry = (name, nationalites = []) => savePays({ name, active: true, nationalites });
  const updateCountryNationalites = (name, nationalites) => {
    const c = countries.find((x) => x.name === name);
    return c ? savePays({ ...c, nationalites }) : null;
  };
  const removeCountry = async (name) => {
    try {
      await axios.delete(`/api/pays/${encodeURIComponent(name)}`);
      await fetchCountries();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  const saveRegle = async (regle) => {
    try {
      if (regle.id) await axios.put(`/api/regles/${regle.id}`, regle);
      else await axios.post('/api/regles', regle);
      await fetchRegles();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };
  const deleteRegle = async (regle) => {
    try {
      await axios.delete(`/api/regles/${regle.id}`);
      await fetchRegles();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  // Langues reconnues (exposées par /api/referentiel)
  const saveLangue = async (langue) => {
    try {
      const res = await axios.post('/api/langues', langue);
      await fetchCriteria();
      return { ok: true, langue: res.data?.langue };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };
  /** force = true : retire d'abord la langue des postes et règles qui l'exigent */
  const deleteLangue = async (langue, force = false) => {
    try {
      const res = await axios.delete(`/api/langues/${encodeURIComponent(langue.code)}`, { params: force ? { force: 1 } : {} });
      await fetchCriteria();
      await fetchRegles();
      return { ok: true, ...res.data };
    } catch (err) {
      return { ok: false, error: apiError(err), status: err?.response?.status, postes: err?.response?.data?.postes, regles: err?.response?.data?.regles };
    }
  };

  /** Archive les dossiers analysés (tous, ou ceux d'un poste) et vide le tableau de bord */
  const archiveCandidates = async (jobTitle = null) => {
    try {
      const res = await axios.delete('/api/candidates', { params: jobTitle ? { jobTitle } : {} });
      await fetchCandidates();
      return { ok: true, ...res.data };
    } catch (err) {
      return { ok: false, error: apiError(err) };
    }
  };

  return (
    <AppContext.Provider
      value={{
        candidates,
        setCandidates,
        loading,
        fetchCandidates,
        referentiel,
        jobCriteria,
        criteriaLoading,
        fetchCriteria,
        saveJob,
        addJob,
        lockJob,
        restoreJob,
        deleteJob,
        saveSousCommission,
        createSousCommission,
        deleteSousCommission,
        reevaluate,
        countries,
        toggleCountry,
        addCountry,
        removeCountry,
        updateCountryNationalites,
        archiveCandidates,
        regles,
        saveRegle,
        deleteRegle,
        saveLangue,
        deleteLangue
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    return { candidates: [], setCandidates: () => {}, loading: false, jobCriteria: [], countries: [], referentiel: null };
  }
  return context;
};
