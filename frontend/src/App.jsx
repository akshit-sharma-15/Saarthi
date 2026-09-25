import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { UploadCloud, FileText, MessageSquare, CheckSquare, Layers, ChevronRight } from 'lucide-react';

import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import AskPage from './pages/AskPage';
import EvaluatePage from './pages/EvaluatePage';
import { CandidateProvider, useCandidate } from './context/CandidateContext';

const navItems = [
  { path: '/', label: 'Upload Resume', icon: UploadCloud, desc: 'Parse & extract' },
  { path: '/profile', label: 'Candidate Profile', icon: FileText, desc: 'Facts & gaps' },
  { path: '/ask', label: 'Ask AI', icon: MessageSquare, desc: 'Grounded Q&A' },
  { path: '/evaluate', label: 'Agent Evaluation', icon: CheckSquare, desc: 'LangGraph pipeline' },
];

function Sidebar() {
  const location = useLocation();
  const { candidate, candidateId, candidatesList, selectCandidate } = useCandidate();

  const uploadedCandidates = candidatesList.filter(c => !c.id.startsWith('sample-'));
  const sampleCandidates = candidatesList.filter(c => c.id.startsWith('sample-'));

  return (
    <aside className="w-[260px] bg-white border-r border-surface-200/80 h-screen fixed top-0 left-0 flex flex-col z-30 shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-surface-200/60">
        <div className="flex items-center gap-3">
          <div className="icon-wrap-dark">
            <Layers size={16} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[13px] font-semibold text-ink-900 tracking-tight leading-tight">
              AI Recruiter Copilot
            </h1>
            <p className="text-[10px] text-ink-400 font-medium tracking-wide mt-0.5">
              SCREENING AGENT v1.0
            </p>
          </div>
        </div>
      </div>

      {/* Active Candidate Switcher */}
      <div className="px-4 py-3 bg-surface-50 border-b border-surface-200/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            Active Candidate
          </span>
          {candidateId && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              candidateId.startsWith('sample-')
                ? 'bg-accent-50 text-accent-700 border border-accent-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {candidateId.startsWith('sample-') ? 'Sample' : 'Uploaded'}
            </span>
          )}
        </div>
        {candidatesList.length > 0 ? (
          <select
            value={candidateId || ''}
            onChange={(e) => selectCandidate(e.target.value)}
            className="w-full bg-white border border-surface-200 text-ink-800 text-[12px] font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent-500 shadow-xs cursor-pointer truncate"
          >
            {uploadedCandidates.length > 0 && (
              <optgroup label="Uploaded Resumes">
                {uploadedCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.years_of_experience ? c.years_of_experience.toFixed(1) : 0}y)
                  </option>
                ))}
              </optgroup>
            )}
            {sampleCandidates.length > 0 && (
              <optgroup label="Benchmark Samples">
                {sampleCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.years_of_experience ? c.years_of_experience.toFixed(1) : 0}y)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <p className="text-[11px] text-ink-400 italic">No resumes ingested yet</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="section-label px-3 mb-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent-50 text-accent-700 shadow-xs border border-accent-100/80'
                  : 'text-ink-500 hover:text-ink-800 hover:bg-surface-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-accent-600 text-white shadow-icon'
                  : 'bg-surface-100 text-ink-400 group-hover:bg-surface-200 group-hover:text-ink-600'
              }`}>
                <Icon size={15} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block leading-tight">{item.label}</span>
                <span className={`text-[10px] font-normal transition-colors ${
                  isActive ? 'text-accent-500' : 'text-ink-300 group-hover:text-ink-400'
                }`}>
                  {item.desc}
                </span>
              </div>
              {isActive && (
                <ChevronRight size={14} className="text-accent-400 shrink-0" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-surface-200/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-[11px] text-ink-400 font-medium">Enterprise HR Agent</span>
          </div>
          <span className="font-mono text-[10px] bg-surface-100 text-ink-500 px-1.5 py-0.5 rounded-md border border-surface-200/60">
            v1.0
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <CandidateProvider>
      <Router>
        <div className="flex min-h-screen bg-surface-50 font-sans text-ink-900">
          <Sidebar />
          {/* Main content: centered with proper max-width */}
          <main className="ml-[260px] flex-1 flex justify-center">
            <div className="w-full max-w-[820px] px-8 py-10">
              <Routes>
                <Route path="/" element={<UploadPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/ask" element={<AskPage />} />
                <Route path="/evaluate" element={<EvaluatePage />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </CandidateProvider>
  );
}
