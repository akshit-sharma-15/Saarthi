import React from 'react';
import { AlertCircle, ArrowRight, Briefcase, GraduationCap, Code2, Calendar, MapPin, Mail, Phone, AlertTriangle, CheckCircle2, ChevronRight, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCandidate } from '../context/CandidateContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { candidate, candidateId } = useCandidate();

  // Empty state — no hardcoded fallback data
  if (!candidate) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 border border-surface-200 flex items-center justify-center mb-5 shadow-icon">
          <UploadCloud size={28} className="text-ink-300" />
        </div>
        <h3 className="text-lg font-semibold text-ink-800 tracking-tight mb-1">No Candidate Selected</h3>
        <p className="text-sm text-ink-400 mb-6 max-w-sm">
          Upload a resume or select a sample candidate to view their parsed profile with verified facts and employment gaps.
        </p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          <UploadCloud size={15} />
          Go to Upload
        </button>
      </div>
    );
  }

  const { candidate: cInfo, education = [], experience = [], skills = {}, employment_gaps = [], years_of_experience = 0 } = candidate;

  // Aggregate skills
  const allSkills = [];
  if (skills && typeof skills === 'object') {
    Object.values(skills).forEach(arr => {
      if (Array.isArray(arr)) allSkills.push(...arr);
    });
  }

  const eduSummary = education.length > 0
    ? `${education[0].degree || 'Degree'} in ${education[0].field || 'Engineering'}`
    : null;

  return (
    <div className="animate-fade-in">
      {/* Header Card */}
      <div className="card-elevated p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-white font-bold text-lg shadow-elevated shrink-0">
              {(cInfo?.name || 'C')[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-ink-900 tracking-tight">
                  {cInfo?.name || "Candidate Profile"}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Resume
                </span>
                {candidateId && (
                  <span className="text-[10px] text-ink-400 font-mono bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">
                    ID: {candidateId}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-500 mt-0.5">
                {experience[0]?.title || ""}
                {experience[0]?.company ? ` at ${experience[0].company}` : ''}
              </p>
              {/* Contact pills */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {cInfo?.email && (
                  <span className="badge-neutral">
                    <Mail size={10} /> {cInfo.email}
                  </span>
                )}
                {cInfo?.location && (
                  <span className="badge-neutral">
                    <MapPin size={10} /> {cInfo.location}
                  </span>
                )}
                {cInfo?.phone && (
                  <span className="badge-neutral">
                    <Phone size={10} /> {cInfo.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/ask')}
            className="btn-secondary text-xs whitespace-nowrap shrink-0"
          >
            Ask AI
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-wrap-accent">
              <Briefcase size={14} className="text-accent-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-ink-900 tracking-tight">
            {years_of_experience ? years_of_experience.toFixed(1) : '0'}
          </p>
          <p className="section-label">Years Experience</p>
          <p className="text-[10px] text-ink-400 mt-0.5">Deterministic date math</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-wrap">
              <GraduationCap size={14} className="text-ink-500" />
            </div>
          </div>
          {eduSummary ? (
            <>
              <p className="text-[13px] font-semibold text-ink-800 leading-tight">{eduSummary}</p>
              <p className="section-label mt-1">Education</p>
              <p className="text-[10px] text-ink-400 mt-0.5 truncate">{education[0]?.institution || ""}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-ink-800 leading-tight">Not specified</p>
              <p className="section-label mt-1">Education</p>
            </>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-wrap">
              <Code2 size={14} className="text-ink-500" />
            </div>
          </div>
          {allSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-1">
              {allSkills.slice(0, 4).map((skill, i) => (
                <span key={i} className="badge-info text-[9px]">{skill}</span>
              ))}
              {allSkills.length > 4 && (
                <span className="badge-neutral text-[9px]">+{allSkills.length - 4}</span>
              )}
            </div>
          ) : (
            <p className="text-[13px] font-semibold text-ink-800 leading-tight">Not extracted</p>
          )}
          <p className="section-label mt-1">Top Skills</p>
        </div>
      </div>

      {/* Gap Alert */}
      {employment_gaps && employment_gaps.length > 0 ? (
        <div className="card border-amber-100 bg-amber-50/30 p-5 mb-6 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 border border-amber-200 shadow-icon shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-[13px] font-semibold text-amber-900">
                Employment Gap{employment_gaps.length > 1 ? 's' : ''} Detected
              </h4>
              {employment_gaps.map((gap, i) => (
                <div key={i} className="mt-2 flex items-start gap-2">
                  <span className="font-mono text-[12px] text-amber-800 font-medium bg-amber-100/60 px-1.5 py-0.5 rounded">
                    {gap.period}
                  </span>
                  <span className={`text-[11px] mt-0.5 ${
                    gap.status === 'unexplained' ? 'text-amber-700' : 'text-amber-600'
                  }`}>
                    {gap.status === 'unexplained'
                      ? '— Unexplained. The system will not infer reasons per anti-hallucination rules.'
                      : gap.reason
                      ? `— ${gap.reason}`
                      : '— Status: ' + gap.status
                    }
                  </span>
                </div>
              ))}
            </div>
            <span className="badge-warning shrink-0">
              <AlertCircle size={10} /> Flagged
            </span>
          </div>
        </div>
      ) : (
        <div className="card bg-emerald-50/30 border-emerald-100 p-4 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-icon">
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <p className="text-[12px] text-emerald-700 font-medium">
            No employment gaps exceeding 60 days detected across all verified roles.
          </p>
        </div>
      )}

      {/* Work History */}
      {experience.length > 0 && (
        <div className="card-elevated p-6 mb-6">
          <p className="section-label mb-5">Work History</p>
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-surface-200" />
            <div className="space-y-6">
              {experience.map((exp, idx) => (
                <div key={idx} className="relative flex gap-4 animate-slide-up" style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="relative z-10 mt-1 shrink-0">
                    <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center border shadow-icon transition-all ${
                      idx === 0
                        ? 'bg-accent-50 border-accent-100 text-accent-600'
                        : 'bg-white border-surface-200 text-ink-400'
                    }`}>
                      <Briefcase size={13} />
                    </div>
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-[13px] font-semibold text-ink-900 leading-tight">{exp.title}</h4>
                        <p className="text-[13px] text-ink-600 font-medium">{exp.company}</p>
                      </div>
                      <span className="badge-neutral shrink-0 mt-0.5">
                        <Calendar size={10} />
                        {exp.start_date} — {exp.end_date}
                      </span>
                    </div>
                    {exp.responsibilities && exp.responsibilities.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {exp.responsibilities.map((r, ri) => (
                          <li key={ri} className="text-[12px] text-ink-500 leading-relaxed flex items-start gap-2">
                            <ChevronRight size={11} className="text-ink-300 mt-0.5 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills Breakdown */}
      {Object.keys(skills).length > 0 && (
        <div className="card p-6 mb-6">
          <p className="section-label mb-4">Skills Breakdown</p>
          <div className="space-y-3">
            {Object.entries(skills).map(([category, skillList]) => (
              <div key={category}>
                <p className="text-[11px] font-medium text-ink-500 capitalize mb-1.5">
                  {category.replace(/_/g, ' ')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(skillList) && skillList.map((skill, i) => (
                    <span key={i} className="badge-info">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-wrap">
            <CheckCircle2 size={14} className="text-ink-500" />
          </div>
          <span className="text-[12px] text-ink-500">
            Ready to run agentic screening or interrogate resume claims?
          </span>
        </div>
        <button onClick={() => navigate('/evaluate')} className="btn-primary text-xs">
          Proceed to Evaluation
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
