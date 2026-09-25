import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Sparkles, Loader2, AlertCircle, ArrowRight, User, Briefcase, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { uploadResume, fetchCandidateProfile } from '../api/client';
import { useCandidate } from '../context/CandidateContext';

export default function UploadPage() {
  const navigate = useNavigate();
  const { setCandidateData, selectCandidate, candidatesList } = useCandidate();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const data = await uploadResume(file);
      setCandidateData(data.resume_id, data.profile);
      setTimeout(() => navigate('/profile'), 400);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to upload and parse resume. Please ensure file is a valid PDF or JSON.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSample = async (sampleId) => {
    setLoading(true);
    setError(null);
    try {
      const prof = await fetchCandidateProfile(sampleId);
      setCandidateData(sampleId, prof);
      setTimeout(() => navigate('/profile'), 300);
    } catch (err) {
      const existing = candidatesList.find(c => c.id === sampleId);
      if (existing) {
        await selectCandidate(existing.id);
        navigate('/profile');
      } else {
        setError('Sample candidate is not yet available. Please restart the backend server.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sample candidates for quick testing
  const sampleCandidates = [
    { id: 'sample-aarav-sharma', name: 'Aarav Sharma', role: 'Senior Backend Engineer', company: 'Razorpay', gap: true, years: '4.9' },
    { id: 'sample-priya-mehta', name: 'Priya Mehta', role: 'Senior Data Scientist', company: 'Flipkart', gap: false, years: '5.2' },
    { id: 'sample-rohit-verma', name: 'Rohit Verma', role: 'Staff Software Engineer', company: 'Google', gap: true, years: '7.5' },
    { id: 'sample-sneha-iyer', name: 'Sneha Iyer', role: 'Frontend Engineer', company: 'Freshworks', gap: true, years: '3.1' },
    { id: 'sample-arjun-nair', name: 'Arjun Nair', role: 'Product Manager', company: 'Chargebee', gap: true, years: '5.8' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-ink-900 tracking-tight">Upload Candidate Resume</h2>
        <p className="text-ink-500 mt-2 text-[14px] leading-relaxed">
          Upload a PDF or JSON resume to begin AI-powered extraction, deterministic fact validation, and employment gap analysis. All facts are verified with anti-hallucination safeguards.
        </p>
      </div>

      {/* Upload Card */}
      <div className="card-elevated p-1.5">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300 cursor-pointer ${
            isDragging
              ? 'border-accent-400 bg-accent-50/60'
              : 'border-surface-200 hover:border-accent-400 hover:bg-accent-50/30'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept=".pdf,.json"
            className="hidden"
          />

          <div className="mx-auto mb-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto transition-all duration-300 ${
              loading
                ? 'bg-accent-50 border border-accent-100 shadow-icon'
                : isDragging
                ? 'bg-accent-100 border border-accent-200 shadow-icon'
                : 'bg-surface-100 border border-surface-200/80 shadow-icon'
            }`}>
              {loading ? (
                <Loader2 size={24} className="animate-spin text-accent-600" />
              ) : (
                <UploadCloud size={24} className={isDragging ? 'text-accent-600' : 'text-ink-400'} />
              )}
            </div>
          </div>

          <h3 className="text-[14px] font-semibold text-ink-800 tracking-tight">
            {loading ? 'Extracting facts & computing experience gaps...' : 'Click to browse or drag & drop your resume'}
          </h3>
          <p className="text-[12px] text-ink-400 mt-1.5">
            Supports PDF (PyMuPDF extraction) and JSON format — Max 10MB
          </p>

          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="badge-neutral"><FileText size={10} /> .pdf</span>
            <span className="badge-neutral"><FileText size={10} /> .json</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 card p-3.5 border-red-100 bg-red-50/50 flex items-start gap-3 animate-slide-up">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 border border-red-100 shadow-icon shrink-0">
            <AlertCircle size={15} className="text-red-500" />
          </div>
          <p className="text-xs font-medium text-red-800 pt-1.5">{error}</p>
        </div>
      )}

      {/* Sample Test Candidates */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label">Sample Test Candidates</p>
            <p className="text-[11px] text-ink-400 mt-0.5">Pre-loaded resumes for testing the evaluation pipeline</p>
          </div>
          <span className="badge-info">
            <Sparkles size={10} /> {sampleCandidates.length} profiles
          </span>
        </div>

        <div className="grid gap-2.5">
          {sampleCandidates.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample.id)}
              disabled={loading}
              className="group card p-4 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-elevated hover:border-surface-300 w-full disabled:opacity-50"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-bold text-sm shadow-icon shrink-0">
                {sample.name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-800 truncate">{sample.name}</span>
                  {sample.gap && (
                    <span className="badge-warning text-[9px]">
                      <AlertTriangle size={8} /> Gap
                    </span>
                  )}
                  {!sample.gap && (
                    <span className="badge-success text-[9px]">
                      <CheckCircle2 size={8} /> Clean
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-ink-500">{sample.role}</span>
                  <span className="text-ink-300">•</span>
                  <span className="text-[11px] text-ink-400">{sample.company}</span>
                  <span className="text-ink-300">•</span>
                  <span className="text-[11px] text-ink-400">{sample.years}y exp</span>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight size={15} className="text-ink-300 group-hover:text-accent-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Previously Uploaded (non-sample) */}
      {candidatesList.filter(c => !c.id.startsWith('sample-')).length > 0 && (
        <div className="mt-8">
          <p className="section-label mb-3">Your Uploaded Resumes</p>
          <div className="grid gap-2">
            {candidatesList.filter(c => !c.id.startsWith('sample-')).slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={async () => {
                  await selectCandidate(c.id);
                  navigate('/profile');
                }}
                className="group card p-3.5 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-elevated hover:border-surface-300 w-full"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-100 border border-surface-200/60 flex items-center justify-center text-ink-400 group-hover:bg-accent-50 group-hover:text-accent-600 group-hover:border-accent-100 transition-all">
                  <User size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-ink-800 block truncate">{c.name}</span>
                  <span className="text-[10px] text-ink-400">
                    {c.years_of_experience ? `${c.years_of_experience.toFixed(1)}y exp` : 'View profile'}
                    {c.gaps_count > 0 && ` • ${c.gaps_count} gap${c.gaps_count > 1 ? 's' : ''}`}
                  </span>
                </div>
                <ArrowRight size={14} className="text-ink-300 group-hover:text-accent-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
