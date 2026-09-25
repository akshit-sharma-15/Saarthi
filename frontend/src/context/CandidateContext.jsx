import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCandidates, fetchCandidateProfile } from '../api/client';

const CandidateContext = createContext();

export function CandidateProvider({ children }) {
  // Synchronous initial state from localStorage to prevent loss on page switches
  const [candidate, setCandidate] = useState(() => {
    try {
      const saved = localStorage.getItem('active_candidate_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [candidateId, setCandidateId] = useState(() => {
    return localStorage.getItem('active_candidate_id') || null;
  });

  const [candidatesList, setCandidatesList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Persistent Chat Histories per candidate
  const [chatHistories, setChatHistories] = useState(() => {
    try {
      const saved = localStorage.getItem('saarthi_chat_histories');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persistent Evaluation Results per candidate
  const [evaluationStates, setEvaluationStates] = useState(() => {
    try {
      const saved = localStorage.getItem('saarthi_eval_states');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveChatHistory = (candId, messages) => {
    if (!candId) return;
    setChatHistories(prev => {
      const updated = { ...prev, [candId]: messages };
      try {
        localStorage.setItem('saarthi_chat_histories', JSON.stringify(updated));
      } catch (e) {
        console.warn('Storage save failed:', e);
      }
      return updated;
    });
  };

  const saveEvaluationState = (candId, stateData) => {
    if (!candId) return;
    setEvaluationStates(prev => {
      const updated = { ...prev, [candId]: stateData };
      try {
        localStorage.setItem('saarthi_eval_states', JSON.stringify(updated));
      } catch (e) {
        console.warn('Storage save failed:', e);
      }
      return updated;
    });
  };

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

  // Load candidates on mount, synchronizing with saved candidate if available
  useEffect(() => {
    async function init() {
      try {
        const list = await fetchCandidates();
        setCandidatesList(list);
        if (list.length > 0) {
          const savedId = localStorage.getItem('active_candidate_id');
          // If already set in state, keep it; otherwise pick saved or first
          const targetId = candidateId || savedId || list[0].id;
          const target = list.find(c => c.id === targetId) || list[0];
          
          if (!candidate || candidateId !== target.id) {
            setCandidateId(target.id);
            localStorage.setItem('active_candidate_id', target.id);
            const prof = await fetchCandidateProfile(target.id);
            setCandidate(prof);
            localStorage.setItem('active_candidate_profile', JSON.stringify(prof));
          }
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
      localStorage.setItem('active_candidate_profile', JSON.stringify(prof));
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
    localStorage.setItem('active_candidate_profile', JSON.stringify(profileData));
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
        chatHistories,
        saveChatHistory,
        evaluationStates,
        saveEvaluationState,
      }}
    >
      {children}
    </CandidateContext.Provider>
  );
}

export function useCandidate() {
  return useContext(CandidateContext);
}
