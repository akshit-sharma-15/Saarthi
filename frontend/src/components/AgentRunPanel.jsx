import React, { useState } from 'react';
import { 
  Play, CheckCircle2, AlertCircle, Loader2, Download, Send, 
  FileCheck, Shield, RefreshCw, Sparkles, ChevronDown, ChevronUp, FileText 
} from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 'parse', title: 'Parse Resume', desc: 'PyMuPDF text extraction & schema parsing' },
  { id: 'compute_facts', title: 'Deterministic Facts', desc: 'Date math for experience & employment gaps' },
  { id: 'evaluate', title: 'HR Evaluation Draft', desc: 'Generate candidate evaluation with citations' },
  { id: 'validate', title: 'Pydantic Validation', desc: 'Schema validation with bounded retry loop' },
  { id: 'document', title: 'Document Generator', desc: 'Executive corporate PDF report via ReportLab' },
  { id: 'dispatch', title: 'Dispatch to HR', desc: 'Deliver evaluation report to HR inbox (SMTP)' },
];

export default function AgentRunPanel({ resumeId, candidateName }) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [stepStatus, setStepStatus] = useState({});
  const [stepDetails, setStepDetails] = useState({});
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [dispatchToHr, setDispatchToHr] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);

  const startAgentRun = () => {
    if (!resumeId || running) return;

    setRunning(true);
    setCompleted(false);
    setStepStatus({});
    setStepDetails({});
    setEvaluationResult(null);
    setPdfUrl(null);
    setDispatchStatus(null);

    // Consume Server-Sent Events (SSE) via fetch + ReadableStream
    fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: resumeId,
        dispatch_to_hr: dispatchToHr,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readChunk() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              setRunning(false);
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep incomplete tail

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                try {
                  const eventData = JSON.parse(trimmed.replace('data:', '').trim());
                  handleSseEvent(eventData);
                } catch (e) {
                  console.error('SSE JSON parse error:', e, trimmed);
                }
              }
            }

            return readChunk();
          });
        }

        return readChunk();
      })
      .catch((err) => {
        console.error('SSE Stream error:', err);
        setRunning(false);
      });
  };

  const handleSseEvent = (data) => {
    const { step, status, detail, evaluation, pdf_url, dispatch_status } = data;

    if (step === 'complete') {
      setCompleted(true);
      setRunning(false);
      if (evaluation) setEvaluationResult(evaluation);
      if (pdf_url) setPdfUrl(pdf_url);
      if (dispatch_status) setDispatchStatus(dispatch_status);
      return;
    }

    if (step === 'error') {
      setRunning(false);
      alert(detail || 'Pipeline step failed.');
      return;
    }

    // Update status for the given step
    setStepStatus((prev) => ({
      ...prev,
      [step]: status === 'ok' ? 'completed' : status === 'retry' ? 'retry' : 'running',
    }));

    if (detail) {
      setStepDetails((prev) => ({
        ...prev,
        [step]: detail,
      }));
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur-sm shadow-xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Autonomous Agent Orchestration
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">LangGraph State Machine Pipeline</p>
        </div>

        {completed && (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pipeline Done
          </span>
        )}
      </div>

      {/* Main Action Trigger Card */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dispatchToHr}
              onChange={(e) => setDispatchToHr(e.target.checked)}
              disabled={running}
              className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <span>Mock Dispatch to HR Inbox (SMTP)</span>
          </label>

          <span className="text-[10px] text-slate-400 font-mono">Max 2 Retries</span>
        </div>

        <button
          onClick={startAgentRun}
          disabled={running || !resumeId}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
            running
              ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-900/40 hover:shadow-indigo-800/60 hover:scale-[1.01]'
          } disabled:opacity-40 disabled:hover:scale-100`}
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
              <span>Orchestrating LangGraph Pipeline...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Generate HR Evaluation</span>
            </>
          )}
        </button>
      </div>

      {/* Live Updating Checklist */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-blue-400" /> Pipeline Progress Checklist
        </h3>

        <div className="space-y-2">
          {PIPELINE_STEPS.map((step) => {
            const status = stepStatus[step.id];
            const detail = stepDetails[step.id];

            return (
              <div
                key={step.id}
                className={`p-3 rounded-lg border transition-all text-xs ${
                  status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : status === 'retry'
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    : status === 'running'
                    ? 'bg-blue-950/30 border-blue-500/40 text-blue-200 animate-pulse'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : status === 'retry' ? (
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    ) : status === 'running' ? (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                    )}

                    <span className={`font-semibold ${status === 'completed' ? 'text-emerald-300' : 'text-slate-200'}`}>
                      {step.title}
                    </span>
                  </div>

                  <span className="text-[10px] uppercase font-mono tracking-wider">
                    {status === 'completed' && <span className="text-emerald-400 font-bold">Done</span>}
                    {status === 'retry' && <span className="text-amber-400 font-bold">Self-Correcting</span>}
                    {status === 'running' && <span className="text-blue-400 font-bold">In Progress</span>}
                    {!status && <span className="text-slate-600">Pending</span>}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-1 pl-6">
                  {detail || step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evaluation Results Artifact Card */}
      {completed && evaluationResult && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-500/40 rounded-xl p-4 shadow-xl flex flex-col gap-4 mt-1">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 block">
                Recommended Designation
              </span>
              <h4 className="text-base font-bold text-white mt-0.5">
                {evaluationResult.recommended_role}
              </h4>
            </div>

            {dispatchStatus && (
              <span className="text-[11px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-300 px-2.5 py-1 rounded-md">
                SMTP: {dispatchStatus}
              </span>
            )}
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              HR Evaluation Synthesis:
            </span>
            <p className="leading-relaxed">{evaluationResult.evaluation_notes}</p>
          </div>

          {/* Primary Skillset Pills */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
              Verified Primary Skillset:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {evaluationResult.primary_skillset?.map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-blue-950/60 border border-blue-500/30 text-blue-200 text-[11px] px-2.5 py-0.5 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Download PDF Button */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition hover:scale-[1.01]"
            >
              <Download className="w-4 h-4" />
              <span>Download Executive Evaluation PDF</span>
            </a>
          )}

          {/* Expandable Evidence Audit Trail */}
          {evaluationResult.evidence && Object.keys(evaluationResult.evidence).length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 font-medium py-1"
              >
                <span>Audit Trail Grounding Citations</span>
                {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showEvidence && (
                <div className="mt-2 space-y-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {Object.entries(evaluationResult.evidence).map(([key, snippet]) => (
                    <div key={key} className="border-b border-slate-900 pb-1.5 last:border-0">
                      <span className="text-[10px] font-mono text-blue-400 capitalize block">
                        {key.replace('_', ' ')}
                      </span>
                      <span className="italic text-slate-300 text-[11px]">"{snippet}"</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
