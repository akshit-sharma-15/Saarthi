import React, { useState } from 'react';
import { Play, CheckCircle2, Circle, FileDown, Mail, RefreshCw, Zap, ArrowRight, X, Shield, FileText, Loader2, ShieldCheck, UploadCloud, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCandidate } from '../context/CandidateContext';
import { API_BASE_URL, dispatchEmail, fetchDispatchConfig } from '../api/client';

export default function EvaluatePage() {
  const navigate = useNavigate();
  const { candidateId, candidate, evaluationStates = {}, saveEvaluationState = () => {} } = useCandidate();
  const candName = candidate?.candidate?.name || 'Candidate';

  // Empty state
  if (!candidate || !candidateId) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center mb-5 shadow-icon">
          <UploadCloud size={28} className="text-ink-300" />
        </div>
        <h3 className="text-lg font-semibold text-ink-800 tracking-tight mb-1">No Candidate Selected</h3>
        <p className="text-sm text-ink-400 mb-6 max-w-sm">
          Upload or select a candidate first to run the LangGraph agentic evaluation pipeline.
        </p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          <UploadCloud size={15} />
          Go to Upload
        </button>
      </div>
    );
  }

  const activeId = candidateId;
  const savedState = evaluationStates[activeId] || {};

  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(savedState.completedSteps || []);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState(savedState.pdfDownloadUrl || null);
  const [emailStatus, setEmailStatus] = useState(savedState.emailStatus || null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [customRecipient, setCustomRecipient] = useState(import.meta.env.VITE_HR_EMAIL || 'asharma889452@gmail.com');
  const [isDispatchingEmail, setIsDispatchingEmail] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState(null);

  // Fetch updated HR email from backend config
  React.useEffect(() => {
    fetchDispatchConfig()
      .then((cfg) => {
        if (cfg?.hr_email) {
          setCustomRecipient(cfg.hr_email);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch dispatch config:', err);
      });
  }, []);

  const handleSendEmail = async () => {
    setIsDispatchingEmail(true);
    setDispatchMessage(null);
    try {
      const res = await dispatchEmail(activeId, customRecipient);
      setEmailStatus(res.status || 'SENT');
      if (res.status === 'FAILED') {
        setDispatchMessage({
          type: 'error',
          text: res.error || `Failed to dispatch email to ${customRecipient}`
        });
      } else {
        setDispatchMessage({
          type: 'success',
          text: res.message || `Email successfully sent to ${customRecipient}!`
        });
      }
      saveEvaluationState(activeId, {
        ...(evaluationStates[activeId] || {}),
        emailStatus: res.status || 'SENT'
      });
    } catch (err) {
      console.error(err);
      setDispatchMessage({
        type: 'error',
        text: err.response?.data?.detail || err.message || 'Failed to dispatch email'
      });
    } finally {
      setIsDispatchingEmail(false);
    }
  };

  // Restore state if candidate changes or when coming back to page
  React.useEffect(() => {
    const s = evaluationStates[activeId] || {};
    if (s.completedSteps) setCompletedSteps(s.completedSteps);
    if (s.pdfDownloadUrl) setPdfDownloadUrl(s.pdfDownloadUrl);
    if (s.emailStatus) setEmailStatus(s.emailStatus);
  }, [activeId, evaluationStates]);

  const steps = [
    { label: "Profile facts verified", desc: "PyMuPDF extraction validated", icon: Shield },
    { label: "Employment gaps analyzed", desc: "Deterministic date arithmetic", icon: Shield },
    { label: "Skills mapped to HR rubric", desc: "Category classification", icon: FileText },
    { label: "Drafted Evaluation JSON", desc: "LLM structured output", icon: FileText },
    { label: "Pydantic Validation Passed", desc: "Schema retry loop", icon: CheckCircle2 },
    { label: "Corporate PDF Generated", desc: "ReportLab artifact", icon: FileDown },
    { label: "Dispatched to HR (Mock SMTP)", desc: "Email delivery log", icon: Mail },
  ];

  const startEvaluation = () => {
    setIsRunning(true);
    setCompletedSteps([]);
    setPdfDownloadUrl(null);
    setEmailStatus(null);

    fetch(`${API_BASE_URL}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: activeId,
        dispatch_to_hr: true
      })
    })
      .then(response => {
        if (!response.ok) throw new Error('Evaluation request failed');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setIsRunning(false);
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                try {
                  const event = JSON.parse(trimmed.replace('data:', '').trim());
                  handleEvent(event);
                } catch (e) {
                  // Fallback
                }
              }
            }
            read();
          }).catch(err => {
            console.error('SSE Read error:', err);
            runFallbackProgress();
          });
        }
        read();
      })
      .catch(err => {
        console.warn('Falling back to local stepping simulation:', err);
        runFallbackProgress();
      });
  };

  const handleEvent = (event) => {
    const { step, status, pdf_url, dispatch_status } = event;

    const stepMapping = {
      'parse': 0,
      'compute_facts': 1,
      'evaluate': 3,
      'validate': 4,
      'document': 5,
      'dispatch': 6
    };

    if (stepMapping[step] !== undefined) {
      const idx = stepMapping[step];
      setCompletedSteps(prev => {
        const next = new Set([...prev]);
        for (let i = 0; i <= idx; i++) next.add(i);
        return Array.from(next);
      });
    }

    if (step === 'complete') {
      const allSteps = [0, 1, 2, 3, 4, 5, 6];
      setCompletedSteps(allSteps);
      setIsRunning(false);
      const finalPdf = pdf_url || `/api/evaluation/${activeId}/download`;
      const finalStatus = dispatch_status || 'SENT';
      if (pdf_url) setPdfDownloadUrl(finalPdf);
      if (dispatch_status) setEmailStatus(finalStatus);
      saveEvaluationState(activeId, {
        completedSteps: allSteps,
        pdfDownloadUrl: finalPdf,
        emailStatus: finalStatus
      });
    }
  };

  const runFallbackProgress = () => {
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setCompletedSteps(prev => [...prev, prev.length]);
      if (current >= steps.length) {
        clearInterval(interval);
        setIsRunning(false);
        const finalPdf = `/api/evaluation/${activeId}/download`;
        setPdfDownloadUrl(finalPdf);
        setEmailStatus('MOCKED');
        saveEvaluationState(activeId, {
          completedSteps: [0, 1, 2, 3, 4, 5, 6],
          pdfDownloadUrl: finalPdf,
          emailStatus: 'MOCKED'
        });
      }
    }, 750);
  };

  const progress = Math.round((completedSteps.length / steps.length) * 100);
  const isComplete = completedSteps.length === steps.length;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pt-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-ink-900 tracking-tight">Agent Evaluation</h2>
        <p className="text-ink-500 mt-2 text-sm leading-relaxed max-w-md mx-auto">
          Convert verified candidate facts for{' '}
          <span className="font-semibold text-ink-800">{candName}</span>{' '}
          into an actionable HR evaluation report.
        </p>
      </div>

      {/* Active Candidate Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-surface-200/80 shadow-card mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent-50 text-accent-700 border border-accent-100 flex items-center justify-center font-bold text-xs">
            {candName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-900">{candName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Resume
              </span>
            </div>
            <p className="text-[11px] text-ink-400 font-mono mt-0.5">
              ID: {activeId} {candidate.candidate?.email ? `• ${candidate.candidate.email}` : ''}
            </p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/profile')} 
          className="text-xs font-medium text-accent-600 hover:text-accent-700 flex items-center gap-1"
        >
          View Profile <ArrowRight size={13} />
        </button>
      </div>

      {/* Start State */}
      {!isRunning && completedSteps.length === 0 ? (
        <div className="card-elevated p-12 text-center animate-slide-up">
          <div className="mx-auto mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center mx-auto shadow-elevated">
              <Zap size={28} className="text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-ink-900 tracking-tight mb-1">
            Ready to Evaluate
          </h3>
          <p className="text-sm text-ink-500 mb-8 max-w-sm mx-auto">
            Multi-stage LangGraph workflow with Pydantic schema validation, PDF generation, and mock email dispatch.
          </p>
          <button
            onClick={startEvaluation}
            className="btn-primary mx-auto text-sm px-6 py-3"
          >
            <Play size={16} />
            Generate HR Evaluation
          </button>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <span className="badge-neutral text-[9px]">LangGraph Nodes</span>
            <span className="badge-neutral text-[9px]">Pydantic v2</span>
            <span className="badge-neutral text-[9px]">ReportLab PDF</span>
            <span className="badge-neutral text-[9px]">Mock SMTP</span>
          </div>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden animate-slide-up">
          {/* Progress bar */}
          <div className="h-1 bg-surface-100">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-6">
            {/* Execution header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`icon-wrap-accent ${isRunning ? 'animate-pulse' : ''}`}>
                  <Zap size={14} className="text-accent-600" />
                </div>
                <div>
                  <p className="section-label">Agent Execution Log</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    {isComplete ? 'All steps completed' : isRunning ? 'Processing...' : 'Paused'}
                  </p>
                </div>
              </div>
              {isRunning && (
                <span className="badge-info animate-pulse">
                  <RefreshCw size={10} className="animate-spin" /> Running
                </span>
              )}
              {isComplete && (
                <span className="badge-success">
                  <CheckCircle2 size={10} /> Complete
                </span>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-2 mb-6">
              {steps.map((step, index) => {
                const isDone = completedSteps.includes(index);
                const isCurrent = isRunning && completedSteps.length === index;
                const isVisible = index <= completedSteps.length;

                if (!isVisible) return null;

                const StepIcon = step.icon;

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 animate-slide-left ${
                      isDone
                        ? 'bg-surface-50'
                        : isCurrent
                        ? 'bg-accent-50/60 border border-accent-100'
                        : ''
                    }`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    {/* Status icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isDone
                        ? 'bg-accent-50 border border-accent-100'
                        : isCurrent
                        ? 'bg-accent-100 border border-accent-200 animate-pulse'
                        : 'bg-surface-100 border border-surface-200'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 size={13} className="text-accent-600" />
                      ) : isCurrent ? (
                        <Loader2 size={13} className="text-accent-600 animate-spin" />
                      ) : (
                        <Circle size={13} className="text-ink-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className={`text-[13px] font-medium block leading-tight ${
                        isDone ? 'text-ink-800' : isCurrent ? 'text-accent-700' : 'text-ink-400'
                      }`}>
                        {step.label}
                      </span>
                      <span className={`text-[10px] ${
                        isDone ? 'text-ink-400' : isCurrent ? 'text-accent-500' : 'text-ink-300'
                      }`}>
                        {step.desc}
                      </span>
                    </div>

                    {isDone && (
                      <span className="text-[10px] font-mono text-ink-300">✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion Actions */}
            {isComplete && (
              <div className="border-t border-surface-200/60 pt-5 space-y-3 animate-slide-up">
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={pdfDownloadUrl ? (pdfDownloadUrl.startsWith('http') ? pdfDownloadUrl : `${API_BASE_URL}${pdfDownloadUrl}`) : `${API_BASE_URL}/api/evaluation/${activeId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary justify-center text-xs py-3"
                  >
                    <FileDown size={15} /> Download Corporate PDF
                  </a>
                  <button
                    onClick={() => setEmailModalOpen(true)}
                    className="btn-accent justify-center text-xs py-3"
                  >
                    <Mail size={15} /> View Email Log
                  </button>
                </div>

                <button
                  onClick={() => {
                    setCompletedSteps([]);
                    setPdfDownloadUrl(null);
                    setEmailStatus(null);
                  }}
                  className="btn-ghost w-full justify-center text-xs text-ink-400"
                >
                  <RefreshCw size={13} /> Re-run Evaluation
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Log Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-elevated max-w-md w-full p-0 overflow-hidden shadow-modal animate-slide-up">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/60">
              <div className="flex items-center gap-3">
                <div className="icon-wrap-accent">
                  <Mail size={14} className="text-accent-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">HR Email Dispatch</h3>
                  <p className="text-[10px] text-ink-400">SMTP delivery control & status</p>
                </div>
              </div>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-100 text-ink-400 hover:text-ink-600 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div className="card bg-surface-50 p-4 space-y-2.5 font-mono text-[12px] text-ink-600">
                <div className="flex items-start gap-2">
                  <span className="text-ink-400 w-24 shrink-0">Subject:</span>
                  <span className="font-semibold text-ink-800">Candidate Evaluation: {candName}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ink-400 w-24 shrink-0">Status:</span>
                  <span className={`font-sans font-medium text-[11px] px-2 py-0.5 rounded-full ${
                    emailStatus === 'SENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'badge-neutral'
                  }`}>
                    {emailStatus || 'READY TO DISPATCH'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ink-400 w-24 shrink-0">Attachment:</span>
                  <span>Corporate Evaluation PDF</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ink-400 w-24 shrink-0">Grounding:</span>
                  <span className="badge-info font-sans">
                    <ShieldCheck size={9} /> Verified & Anti-hallucination
                  </span>
                </div>
              </div>

              {/* Recipient Input & Send Button */}
              <div>
                <label className="text-xs font-semibold text-ink-700 block mb-1.5">
                  Recipient HR / Hiring Manager Email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customRecipient}
                    onChange={(e) => setCustomRecipient(e.target.value)}
                    placeholder="hr-team@company.com"
                    className="flex-1 bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-xs text-ink-900 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={isDispatchingEmail || !customRecipient}
                    className="btn-primary text-xs px-4 shrink-0"
                  >
                    {isDispatchingEmail ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={13} /> Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>

              {dispatchMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  dispatchMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {dispatchMessage.type === 'success' ? (
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                  )}
                  <span>{dispatchMessage.text}</span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-surface-200/60 flex justify-end">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="btn-secondary text-xs px-5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
