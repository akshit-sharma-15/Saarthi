import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const fetchCandidates = async () => {
  const response = await api.get('/api/candidates');
  return response.data;
};

export const fetchCandidateProfile = async (resumeId) => {
  const response = await api.get(`/api/candidate/${resumeId}`);
  return response.data;
};

export const askQuestion = async (resumeId, question) => {
  const response = await api.post('/api/chat', {
    resume_id: resumeId,
    question,
  });
  return response.data;
};

export const dispatchEmail = async (evaluationId, recipient) => {
  const response = await api.post('/api/dispatch/email', {
    evaluation_id: evaluationId,
    recipient,
  });
  return response.data;
};

export default api;
