import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCandidates, fetchCandidateProfile } from '../api/client';

const CandidateContext = createContext();

export function CandidateProvider({ children }) {
  const [candidate, setCandidate] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [candidatesList, setCandidatesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load existing candidates on mount
  useEffect(() => {
    async function init() {
      try {
        const list = await fetchCandidates();
        setCandidatesList(list);
        if (list.length > 0 && !candidateId) {
          const first = list[0];
          setCandidateId(first.id);
          const prof = await fetchCandidateProfile(first.id);
          setCandidate(prof);
        }
      } catch (err) {
        console.error('Failed to fetch initial candidates:', err);
      }
    }
    init();
  }, []);

  const selectCandidate = async (id) => {
    setLoading(true);
    try {
      setCandidateId(id);
      const prof = await fetchCandidateProfile(id);
      setCandidate(prof);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setCandidateData = (id, profileData) => {
    setCandidateId(id);
    setCandidate(profileData);
    // Refresh candidate list
    fetchCandidates().then(setCandidatesList).catch(() => {});
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
      }}
    >
      {children}
    </CandidateContext.Provider>
  );
}

export function useCandidate() {
  return useContext(CandidateContext);
}
