import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': 'v1.0.0',
  },
});

apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response && error.response.data && error.response.data.detail) {
      return Promise.reject(new Error(error.response.data.detail));
    }
    return Promise.reject(error);
  }
);
