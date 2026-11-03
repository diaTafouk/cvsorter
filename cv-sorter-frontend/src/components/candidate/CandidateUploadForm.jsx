import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import axios from "axios"; // Assurez-vous d'importer axios si ce n'est pas déjà fait

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_FILE_SIZE_MB = 10;

export const CandidateUpload = () => {
  // Récupération de la fonction d'ajout depuis le contexte global
  const { addCandidate } = useApp();

  const [files, setFiles] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("Mali"); // Valeur par défaut ou liée à un sélecteur
  const [selectedJob, setSelectedJob] = useState("Développeur Fullstack"); // Valeur par défaut ou liée à un sélecteur
  
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    const isPdf = fileExtension === ".pdf";
    const isWord = fileExtension === ".doc" || fileExtension === ".docx";

    if (!isPdf && !isWord) {
      return `Le fichier "${file.name}" n'est pas un document PDF ou Word valide.`;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `Le fichier "${file.name}" dépasse la limite de ${MAX_FILE_SIZE_MB} Mo.`;
    }

    return null;
  };

  const handleFilesAdded = (incomingFiles) => {
    setErrorMessage("");
    setUploadSuccess(false);

    const validFiles = [];
    let error = null;

    Array.from(incomingFiles).forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        error = validationError;
      } else {
        if (!files.some((f) => f.name === file.name && f.size === file.size)) {
          validFiles.push(file);
        }
      }
    });

    if (error) setErrorMessage(error);
    if (validFiles.length > 0) setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length === 1) setErrorMessage("");
  };

  // Envoi effectif vers le Backend Express et PostgreSQL (Correction de la syntaxe)
  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      
      // On utilise le tableau local 'files' au lieu de 'selectedFiles'
      for (let i = 0; i < files.length; i++) {
        formData.append('cvs', files[i]); // Correspond à multer .array('cvs') coté backend
      }
      formData.append('country', selectedCountry);
      formData.append('jobTitle', selectedJob);

      // Envoi asynchrone vers l'API d'analyse multiple
      const response = await axios.post('/api/candidates/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || "Erreur lors du traitement des CVs sur le serveur.");
      }

      // Synchronisation avec le contexte global si les candidats ont bien été enregistrés en DB
      if (data.success && Array.isArray(data.candidates)) {
        data.candidates.forEach((candidate) => {
          if (typeof addCandidate === "function") {
            addCandidate(candidate);
          }
        });
      }

      setIsUploading(false);
      setUploadSuccess(true);
      setFiles([]);
    } catch (err) {
      console.error("Erreur d'upload :", err);
      setIsUploading(false);
      setErrorMessage(
        err.response?.data?.error || err.message || "Impossible de joindre le serveur (Vérifiez que le backend tourne)."
      );
    }
  };

  const getFileBadge = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      return (
        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded border border-red-200">
          PDF
        </span>
      );
    }
    return (
      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded border border-blue-200">
        WORD
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Charger les CV des Candidats
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Importez vos documents au format <strong>PDF</strong> (`.pdf`) ou <strong>Word</strong> (`.doc`, `.docx`).
        </p>
      </div>

      {/* Zone de Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50"
            : "border-gray-300 hover:border-indigo-400 bg-gray-50/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFilesAdded(e.target.files)}
        />

        <div className="flex flex-col items-center space-y-3">
          <div className="p-3 bg-white rounded-full shadow-sm border border-gray-100">
            <Upload className="w-8 h-8 text-indigo-600" />
          </div>
          
          <div>
            <p className="text-base font-medium text-gray-700">
              Glissez-déposez vos fichiers ici
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              Limite de taille : {MAX_FILE_SIZE_MB} Mo par fichier (Sélection multiple autorisée)
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Parcourir les fichiers (PDF ou Word)</span>
          </button>
        </div>
      </div>

      {/* Messages d'alerte */}
      {errorMessage && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Les CV ont été analysés, évalués et enregistrés en base de données avec succès !</span>
        </div>
      )}

      {/* Liste des fichiers prêts */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-700">
            Fichiers prêts pour l'envoi ({files.length})
          </h2>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {file.name}
                  </span>
                  {getFileBadge(file.name)}
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    ({(file.size / (1024 * 1024)).toFixed(2)} Mo)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center space-x-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyse et traitement en cours...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Lancer l'analyse et l'enregistrement</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};