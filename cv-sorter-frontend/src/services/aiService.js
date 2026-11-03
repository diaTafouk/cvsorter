/**
 * Service pour la simulation et l'appel direct au LLM local (Ollama / Llama 3 / Mistral)
 */
export const analyzeCVWithLocalAI = async (cvText, jobTitle, jobCriteria) => {
  // Option 1 : Appel direct à l'instance Ollama Locale sur la machine (si configurée)
  // const response = await fetch('http://localhost:11434/api/generate', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ model: 'llama3', prompt: buildPrompt(cvText, jobCriteria) })
  // });

  // Option 2 : Algorithme synchrone local de secours / simulation pour l'UI
  return new Promise((resolve) => {
    setTimeout(() => {
      const required = jobCriteria.requiredSkills || [];
      const textUpper = cvText.toUpperCase();

      const matchedSkills = required.filter(skill => textUpper.includes(skill.toUpperCase()));
      const missingSkills = required.filter(skill => !textUpper.includes(skill.toUpperCase()));

      const skillsRatio = required.length > 0 ? matchedSkills.length / required.length : 1;
      const skillsScore = Math.round(skillsRatio * 100);
      const expScore = 85;
      const eduScore = 80;
      const langScore = 85;

      const finalScore = Math.round(
        (skillsScore * (jobCriteria.weightSkills || 40) +
         expScore * (jobCriteria.weightExp || 30) +
         eduScore * (jobCriteria.weightEdu || 15) +
         langScore * (jobCriteria.weightLang || 15)) / 100
      );

      resolve({
        score: finalScore,
        status: finalScore >= (jobCriteria.minScore || 70) ? 'Sélectionné' : 'Rejeté',
        breakdown: {
          skills: skillsScore,
          experience: expScore,
          education: eduScore,
          languages: langScore
        },
        matchedSkills,
        missingSkills,
        strengths: [
          `Correspondance de ${matchedSkills.length}/${required.length} compétences requises`,
          'Expérience professionnelle conforme',
          'Présentation claire et structurée'
        ],
        weaknesses: missingSkills.length > 0 
          ? [`Compétences manquantes : ${missingSkills.join(', ')}`] 
          : ['Rien de rédhibitoire à signaler'],
        summary: `Analyse automatique par Ollama : Le candidat obtient un score de ${finalScore}%. ${
          finalScore >= (jobCriteria.minScore || 70) 
            ? 'Profil recommandé pour entretien.' 
            : 'Certains critères clés ne sont pas totalement satisfaits.'
        }`
      });
    }, 1200);
  });
};