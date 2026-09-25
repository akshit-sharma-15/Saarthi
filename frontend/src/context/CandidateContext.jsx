import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCandidates, fetchCandidateProfile } from '../api/client';

const CandidateContext = createContext();

export function CandidateProvider({ children }) {
  const [candidate, setCandidate] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [candidatesList, setCandidatesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Refresh candidate list helper
  const refreshCandidates = async () => {
    try {
      const list = await fetchCandidates();
      setCandidatesList(list);
      return list;
    } catch (err) {
      console.error('Failed to refresh candidates:', err);
      return [];
    }
  };

  // Load candidates on mount, restoring saved candidate if available
  useEffect(() => {
    async function init() {
      try {
        const list = await fetchCandidates();
        setCandidatesList(list);
        if (list.length > 0) {
          const savedId = localStorage.getItem('active_candidate_id');
          const target = (savedId && list.find(c => c.id === savedId)) || list[0];
          setCandidateId(target.id);
          localStorage.setItem('active_candidate_id', target.id);
          const prof = await fetchCandidateProfile(target.id);
          setCandidate(prof);
        }
      } catch (err) {
        console.error('Failed to fetch initial candidates:', err);
      }
    }
    init();
  }, []);

  const selectCandidate = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      setCandidateId(id);
      localStorage.setItem('active_candidate_id', id);
      const prof = await fetchCandidateProfile(id);
      setCandidate(prof);
    } catch (err) {
      console.error('Error selecting candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  const setCandidateData = (id, profileData) => {
    setCandidateId(id);
    setCandidate(profileData);
    localStorage.setItem('active_candidate_id', id);
    // Refresh list so newly uploaded resume is immediately in the switcher
    refreshCandidates();
  };

  return (
    <CandidateContext.Provider
      value={{
        candidate,
        candidateId,
        candidatesList,
        loading,
        selectCandidate,
        setCandidateData,
        refreshCandidates,
      }}
    >
      {children}
    </CandidateContext.Provider>
  );
}

export function useCandidate() {
  return useContext(CandidateContext);
}
