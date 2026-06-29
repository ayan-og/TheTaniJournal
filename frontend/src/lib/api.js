import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const tok = localStorage.getItem("tani_session_token");
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

export default api;
