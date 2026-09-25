import React from 'react';
import { User, Mail, Phone, MapPin, Briefcase, GraduationCap, AlertTriangle, CheckCircle, Award, Code2, Database, Cloud, Layers } from 'lucide-react';

export default function ProfileSummary({ profile }) {
  if (!profile) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
          <User className="w-6 h-6" />
        </div>
        <h3 className="text-slate-300 font-medium text-sm">No Candidate Loaded</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Upload a resume or load the benchmark candidate to review the verified candidate profile.
        </p>
      </div>
    );
  }

  const { candidate, experience = [], education = [], skills = {}, certifications = [], employment_gaps = [], years_of_experience = 0 } = profile;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur-sm shadow-xl flex flex-col gap-5">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {candidate?.name || 'Unnamed Candidate'}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
            {candidate?.email && (
              <span className="flex items-center gap-1 hover:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> {candidate.email}
              </span>
            )}
            {candidate?.phone && (
              <span className="flex items-center gap-1 hover:text-slate-200">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> {candidate.phone}
              </span>
            )}
            {candidate?.location && (
              <span className="flex items-center gap-1 hover:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> {candidate.location}
              </span>
            )}
          </div>
        </div>

        {/* Highlighted Stat Cards */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-950/60 border border-blue-500/30 rounded-lg px-3 py-1.5 text-right">
            <span className="text-[10px] text-blue-300 block font-semibold uppercase tracking-wider">Experience</span>
            <span className="text-sm font-bold text-blue-400 font-mono">
              {years_of_experience?.toFixed(1) || 0} yrs
            </span>
            <span className="text-[9px] text-blue-300/70 block">Deterministic</span>
          </div>

          <div className={`rounded-lg px-3 py-1.5 text-right border ${
            employment_gaps.length > 0
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className="text-[10px] block font-semibold uppercase tracking-wider">Gaps</span>
            <span className="text-sm font-bold font-mono">
              {employment_gaps.length} detected
            </span>
            <span className="text-[9px] opacity-75 block">&gt; 60 days</span>
          </div>
        </div>
      </div>

      {/* CRITICAL: Employment Gaps Alert Section */}
      {employment_gaps && employment_gaps.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/60 to-amber-950/40 border-2 border-rose-500/60 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <span>Anti-Hallucination Employment Gap Notice</span>
          </div>

          <p className="text-xs text-rose-200/90 leading-relaxed mb-3">
            Deterministic interval calculation detected unexplained career gap(s). As per strict anti-hallucination rules, the system will never infer or fabricate reasons:
          </p>

          <div className="flex flex-col gap-2">
            {employment_gaps.map((gap, idx) => (
              <div
                key={idx}
                className="bg-slate-950/80 border border-rose-500/30 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-rose-400">{gap.period}</span>
                  <span className="ml-2 text-slate-400">
                    Reason:{' '}
                    <span className="italic text-slate-300">
                      {gap.reason || 'Unstated in resume (Refused inference)'}
                    </span>
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  gap.status === 'explained'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {gap.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience History */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-blue-400" /> Verified Work Experience
        </h3>
        <div className="space-y-3">
          {experience.map((exp, idx) => (
            <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-100">{exp.title}</span>
                <span className="text-[11px] font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">
                  {exp.start_date} → {exp.end_date}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{exp.company}</p>
              {exp.responsibilities && exp.responsibilities.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {exp.responsibilities.map((r, rIdx) => (
                    <li key={rIdx} className="text-xs text-slate-300/90 flex items-start gap-1.5">
                      <span className="text-blue-500 text-base leading-none">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Technical Skills */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-indigo-400" /> Technical Skills
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(skills).map(([category, items]) => {
            if (!items || items.length === 0) return null;
            return (
              <div key={category} className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-2.5">
                <span className="text-[11px] font-semibold text-slate-400 capitalize block mb-1.5">
                  {category}
                </span>
                <div className="flex flex-wrap gap-1">
                  {items.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="bg-slate-800/80 border border-slate-700 text-slate-200 px-2 py-0.5 rounded text-[11px]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Education & Certifications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-purple-400" /> Education
          </h3>
          {education.map((edu, idx) => (
            <div key={idx} className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-2.5 text-xs">
              <span className="font-semibold text-slate-200 block">{edu.institution}</span>
              <span className="text-slate-400 text-[11px] block">{edu.degree} in {edu.field} ({edu.year})</span>
            </div>
          ))}
        </div>

        {certifications && certifications.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" /> Certifications
            </h3>
            <div className="space-y-1.5">
              {certifications.map((cert, idx) => (
                <div key={idx} className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-2 text-xs text-slate-300">
                  {cert}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
