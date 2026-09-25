import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Quote, ShieldCheck, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { askQuestion } from '../api/client';

const PRESET_QUESTIONS = [
  "What are their primary programming languages?",
  "Did they work at Microsoft or Google?",
  "Why is there a gap between 2023 and 2025?",
  "What were their key accomplishments at Swiggy?"
];

export default function ChatPanel({ resumeId, candidateName }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your AI Recruiter Copilot. Ask any question about ${candidateName || 'the candidate'}. Every answer is evidence-grounded and cited against verified resume records. If a fact or reason is not explicitly documented, I will refuse to infer or hallucinate it.`,
      evidence: null,
      grounded: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (qToSend) => {
    const question = (qToSend || inputQuestion).trim();
    if (!question || !resumeId || loading) return;

    const userMsg = {
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const response = await askQuestion(resumeId, question);
      const aiMsg = {
        role: 'assistant',
        content: response.answer,
        evidence: response.evidence,
        grounded: response.grounded,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error communicating with the Q&A service.',
          evidence: null,
          grounded: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col h-[560px] backdrop-blur-sm shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Evidence-Grounded Candidate Q&A</h2>
            <p className="text-[11px] text-slate-400">Zero-hallucination verification • Strict citation backing</p>
          </div>
        </div>

        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded Mode
        </span>
      </div>

      {/* Preset Question Pills */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 font-medium">
          <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
        </span>
        {PRESET_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading || !resumeId}
            className="shrink-0 bg-slate-800/70 hover:bg-slate-750 hover:border-slate-600 border border-slate-700/80 text-slate-300 px-2.5 py-1 rounded-full text-[11px] transition disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-[85%] rounded-xl p-3.5 text-xs ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 ml-auto'
                : 'bg-slate-950/70 border border-slate-800 text-slate-200'
            }`}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-semibold text-[11px] text-slate-300">
                  {msg.role === 'user' ? 'Recruiter' : 'AI Recruiter Copilot'}
                </span>
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
              </div>

              {/* Main message text */}
              <p className="leading-relaxed text-slate-100 whitespace-pre-wrap">{msg.content}</p>

              {/* Grounding Badge */}
              {msg.role === 'assistant' && msg.evidence !== undefined && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    msg.grounded
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {msg.grounded ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> Verified in Resume
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3" /> Absent from Resume
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Visually Separated Evidence Box */}
              {msg.evidence && (
                <div className="mt-2.5 bg-slate-900/90 border-l-2 border-blue-500 rounded p-2 text-[11px] text-slate-300 flex items-start gap-1.5 shadow-sm">
                  <Quote className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">
                      Supporting Resume Evidence:
                    </span>
                    <span className="italic font-mono text-slate-300/90">"{msg.evidence}"</span>
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              <span>Checking resume facts & verifying evidence citations...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !resumeId}
          placeholder={resumeId ? "Ask a question about this candidate..." : "Please load a candidate first..."}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !inputQuestion.trim() || !resumeId}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-blue-900/30"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </div>
    </div>
  );
}
