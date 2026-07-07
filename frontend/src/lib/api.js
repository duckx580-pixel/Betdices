import axios from "axios";

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
};

const BACKEND_URL = normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL);
const TOKEN_KEY = "betdice_token";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({ baseURL: API });

export const logApiError = (context, err) => {
  const details = {
    context,
    message: err?.message,
    code: err?.code,
    method: err?.config?.method?.toUpperCase?.(),
    url: err?.config?.url,
    baseURL: err?.config?.baseURL,
    status: err?.response?.status,
    responseData: err?.response?.data,
    isNetworkOrCorsError: !err?.response && !!err?.request,
  };

  console.error("[BetDice API Error]", details);
};

if (!BACKEND_URL) {
  console.warn("[BetDice API] REACT_APP_BACKEND_URL is not set. Falling back to relative /api.");
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && token !== "undefined" && token !== "null") {
    if (!config.headers) config.headers = {};
    config.headers.Authorization = "Bearer " + token;
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    logApiError("axios-response-interceptor", err);
    if (err.response?.status === 401) {
      // token invalid, clear
      localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (grow_id, password) => api.post("/auth/login", { grow_id, password }).then((r) => r.data),
  register: (grow_id, password) => api.post("/auth/register", { grow_id, password }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const configApi = {
  get: () => api.get("/config").then((r) => r.data),
};

export const depositApi = {
  create: (payload) => api.post("/deposits", payload).then((r) => r.data),
  mine: () => api.get("/deposits/me").then((r) => r.data),
};

export const withdrawApi = {
  create: (payload) => api.post("/withdraws", payload).then((r) => r.data),
  mine: () => api.get("/withdraws/me").then((r) => r.data),
};

export const tipApi = {
  send: (payload) => api.post("/tips", payload).then((r) => r.data),
};

export const gamesApi = {
  bet: (payload) => api.post("/games/bet", payload).then((r) => r.data),
  history: () => api.get("/games/history").then((r) => r.data),
};

export const adminApi = {
  deposits: (status) => api.get("/admin/deposits", { params: status ? { status } : {} }).then((r) => r.data),
  decideDeposit: (id, status, admin_note) =>
    api.post(`/admin/deposits/${id}/decide`, { status, admin_note }).then((r) => r.data),
  withdraws: () => api.get("/admin/withdraws").then((r) => r.data),
  decideWithdraw: (id, status, admin_note) =>
    api.post(`/admin/withdraws/${id}/decide`, { status, admin_note }).then((r) => r.data),
  stats: () => api.get("/admin/stats").then((r) => r.data),
};

export const chatApi = {
  list: () => api.get("/chat/messages").then((r) => r.data),
  send: (message) => api.post("/chat/messages", { message }).then((r) => r.data),
};
