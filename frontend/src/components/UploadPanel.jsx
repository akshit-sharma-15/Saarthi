import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, FolderOpen } from 'lucide-react';
import { uploadResume } from '../api/client';

export default function UploadPanel({ onResumeLoaded, currentCandidate, candidatesList, onSelectCandidate }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileProcess = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);

    try {
      const data = await uploadResume(file);
      if (onResumeLoaded) {
        onResumeLoaded(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to upload and parse resume.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleLoadSample = async () => {
    // If sample candidate already exists in list, select it
    const sample = candidatesList.find(c => c.id === 'sample-aarav-sharma' || c.name?.includes('Aarav'));
    if (sample) {
      onSelectCandidate(sample.id);
      return;
    }
    // Otherwise fetch the sample json from backend
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/candidate/sample-aarav-sharma');
      if (response.ok) {
        const profile = await response.json();
        onResumeLoaded({
          resume_id: 'sample-aarav-sharma',
          filename: 'aarav_sharma.json',
          profile
        });
      } else {
        setError('Sample candidate not yet loaded.');
      }
    } catch (err) {
      setError('Failed to load sample candidate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur-sm shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-400" />
          Resume Ingestion
        </h2>
        {currentCandidate && (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3" /> Loaded
          </span>
        )}
      </div>

      {/* Drag & Drop Box */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
          accept=".pdf,.json,.txt"
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-1">
          {loading ? (
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileText className="w-6 h-6" />
          )}
        </div>

        <p className="text-sm font-medium text-slate-200">
          {loading ? 'Processing & extracting...' : 'Drop PDF or JSON resume here'}
        </p>
        <p className="text-xs text-slate-400">
          Click to browse or drag files (supports PyMuPDF text & JSON schema)
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Load Sample Candidate Button */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
        <button
          onClick={handleLoadSample}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-900/30 transition-all duration-150 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-blue-200" />
          Load Benchmark Candidate (Aarav Sharma)
        </button>

        {/* Existing Candidates Selector */}
        {candidatesList.length > 0 && (
          <div className="mt-1">
            <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
              Switch Loaded Candidate:
            </label>
            <select
              value={currentCandidate?.id || ''}
              onChange={(e) => onSelectCandidate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {candidatesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.years_of_experience?.toFixed(1) || 0} yrs exp)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
