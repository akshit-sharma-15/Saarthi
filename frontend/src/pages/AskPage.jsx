import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Sparkles, ShieldCheck, ShieldAlert, Loader2, User, Bot, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { askQuestion } from '../api/client';
import { useCandidate } from '../context/CandidateContext';

export default function AskPage() {
  const navigate = useNavigate();
  const { candidateId, candidate } = useCandidate();
  const messagesEndRef = useRef(null);

  const candName = candidate?.candidate?.name || 'Candidate';

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  // Initialize welcome message when candidate changes
  useEffect(() => {
    if (candidate) {
      setMessages([{
        role: 'agent',
        text: `Ready to answer questions about ${candName}. All responses are strictly grounded in resume text with evidence citations. If information is absent, the system will explicitly state "Not specified in the resume."`,
        evidence: null,
        grounded: true
      }]);
    }
  }, [candidateId]);

  const presetQueries = [
    "What are their primary programming skills?",
    "Did they work at Microsoft or Google?",
    "Are there any unexplained employment gaps?",
    "What was their most recent role and impact?"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionText) => {
    const q = (questionText || query).trim();
    if (!q || loading || !candidateId) return;

    const userMessage = { role: 'user', text: q };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await askQuestion(candidateId, q);
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: response.answer,
          evidence: response.evidence,
          grounded: response.grounded
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          text: 'Unable to communicate with the verification engine. Please ensure the backend is running.',
          evidence: null,
          grounded: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Empty state
  if (!candidate || !candidateId) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center mb-5 shadow-icon">
          <UploadCloud size={28} className="text-ink-300" />
        </div>
        <h3 className="text-lg font-semibold text-ink-800 tracking-tight mb-1">No Candidate Selected</h3>
        <p className="text-sm text-ink-400 mb-6 max-w-sm">
          Upload or select a candidate first to begin asking grounded questions about their resume.
        </p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          <UploadCloud size={15} />
          Go to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink-900 tracking-tight">Ask AI</h2>
          <p className="text-[13px] text-ink-500 mt-1">
            Interrogate parsed resume facts with evidence-based, anti-hallucination responses.
          </p>
        </div>
        <span className="badge-info mt-1">
          <User size={10} /> {candName}
        </span>
      </div>

      {/* Preset Prompts */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <div className="icon-wrap shrink-0">
          <Sparkles size={14} className="text-ink-400" />
        </div>
        {presetQueries.map((pq, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(pq)}
            disabled={loading}
            className="shrink-0 card px-3 py-1.5 text-[11px] font-medium text-ink-600 hover:text-accent-700 hover:border-accent-200 hover:bg-accent-50/50 hover:shadow-elevated transition-all duration-200 disabled:opacity-50 whitespace-nowrap"
          >
            {pq}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`flex gap-3 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 mt-1 w-8 h-8 rounded-lg flex items-center justify-center shadow-icon border ${
                msg.role === 'user'
                  ? 'bg-ink-900 text-white border-ink-800'
                  : 'bg-accent-50 text-accent-600 border-accent-100'
              }`}>
                {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>

              <div className={`${
                msg.role === 'user'
                  ? 'card bg-ink-900 text-white p-4 rounded-2xl rounded-tr-lg'
                  : 'card-elevated p-4 rounded-2xl rounded-tl-lg'
              }`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    msg.role === 'user' ? 'text-white/60' : 'text-ink-400'
                  }`}>
                    {msg.role === 'user' ? 'Recruiter' : 'AI Copilot'}
                  </span>
                  {msg.role === 'agent' && msg.grounded !== undefined && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                      msg.grounded
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {msg.grounded
                        ? <><ShieldCheck size={10} /> Grounded</>
                        : <><ShieldAlert size={10} /> Absent from Resume</>
                      }
                    </span>
                  )}
                </div>

                <p className={`text-[13px] leading-relaxed ${msg.role === 'user' ? 'text-white/90' : 'text-ink-700'}`}>
                  {msg.text}
                </p>

                {msg.evidence && (
                  <div className="mt-3 rounded-xl bg-accent-50/60 border border-accent-100 p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText size={12} className="text-accent-600" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                        Verified Evidence
                      </span>
                    </div>
                    <p className="text-[12px] text-accent-800 italic leading-relaxed">"{msg.evidence}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-slide-up">
            <div className="flex gap-3">
              <div className="shrink-0 mt-1 w-8 h-8 rounded-lg flex items-center justify-center shadow-icon bg-accent-50 text-accent-600 border border-accent-100">
                <Bot size={13} />
              </div>
              <div className="card-elevated px-5 py-3.5 rounded-2xl rounded-tl-lg flex items-center gap-2.5">
                <Loader2 size={14} className="animate-spin text-accent-600" />
                <span className="text-xs text-ink-400 font-medium">Verifying resume claims...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-surface-200/60 bg-surface-50">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            placeholder="Ask about skills, gaps, or experience..."
            className="input-field pr-14 shadow-card"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 transition-all shadow-icon disabled:opacity-30"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
