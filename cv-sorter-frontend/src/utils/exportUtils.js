import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Exporte la liste des candidats au format Excel (.xlsx)
 */
export const exportToExcel = (candidates, filename = 'Candidats_Filtres.xlsx') => {
  const formattedData = candidates.map((c) => ({
    'Nom': c.lastName,
    'Prénom': c.firstName,
    'Pays': c.country,
    'Poste Cible': c.jobTitle,
    'Score IA (%)': c.evaluation?.score || 0,
    'Statut': c.evaluation?.status || 'Non évalué',
    'Points Forts': c.evaluation?.strengths ? c.evaluation.strengths.join(', ') : '',
    'Analyse IA': c.evaluation?.summary || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidats');

  XLSX.writeFile(workbook, filename);
};

/**
 * Génère un rapport PDF stylisé et téléchargeable avec jsPDF
 */
export const exportToPDF = (candidates, title = 'Rapport de Sélection des Candidats') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // En-tête du document
  doc.setFillColor(79, 70, 229); // Couleur Indigo
  doc.rect(0, 0, 297, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Zone d'analyse : Burkina Faso | Mali | Niger  —  Date : ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);

  // Colonnes et Données
  const tableColumn = ['Nom & Prénom', 'Pays', 'Poste Cible', 'Score IA', 'Statut', 'Points Forts'];
  const tableRows = candidates.map((c) => [
    `${c.lastName.toUpperCase()} ${c.firstName}`,
    c.country,
    c.jobTitle,
    `${c.evaluation?.score || 0}%`,
    c.evaluation?.status || 'En attente',
    c.evaluation?.strengths ? c.evaluation.strengths.join('\n• ') : 'N/A',
  ]);

  // Génération du Tableau avec AutoTable
  doc.autoTable({
    startY: 34,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 55 },
      3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 80 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} sur ${pageCount} — Document généré par CV SmartFilter IA`, 14, 200);
  }

  // Téléchargement du fichier
  doc.save(`Rapport_CV_Tri_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Lance l'impression native du navigateur
 */
export const triggerPrintPDF = () => {
  window.print();
};