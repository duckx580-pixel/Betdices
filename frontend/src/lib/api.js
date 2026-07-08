import axios from "axios";

const API_BASE_URL = "https://hammerhead-app-rio26.ondigitalocean.app";
const TOKEN_KEY = "betdice_token";
export const API = `${API_BASE_URL}/api`;
export const WS_BASE = API_BASE_URL.replace(/^http/i, "ws");

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

api.interceptors.request.use((config) => {
  if (typeof config.url === "string" && !/^https?:\/\//i.test(config.url)) {
    const relativePath = config.url.startsWith("/") ? config.url : `/${config.url.replace(/^api\/?/i, "")}`;
    config.url = `${API}${relativePath}`;
    config.baseURL = undefined;
  }

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
  growtopiaItems: () => api.get("/admin/growtopia-items").then((r) => r.data),
  createCase: (payload) => api.post("/admin/cases", payload).then((r) => r.data),
  updateCase: (caseId, payload) => api.put(`/admin/cases/${caseId}`, payload).then((r) => r.data),
};

export const chatApi = {
  list: () => api.get("/chat/messages").then((r) => r.data),
  send: (message) => api.post("/chat/messages", { message }).then((r) => r.data),
};

export const casesApi = {
  list: (activeOnly = true) => api.get("/cases", { params: { active_only: activeOnly } }).then((r) => r.data),
  get: (id) => api.get(`/cases/${id}`).then((r) => r.data),
  open: (id) => api.post(`/cases/${id}/open`).then((r) => r.data),
  myOpens: () => api.get("/cases/me/opens").then((r) => r.data),
};

export const battlesApi = {
  list: (status) => api.get("/battles", { params: status ? { status } : {} }).then((r) => r.data),
  create: (payload) => api.post("/battles", payload).then((r) => r.data),
  get: (id) => api.get(`/battles/${id}`).then((r) => r.data),
  join: (id) => api.post(`/battles/${id}/join`).then((r) => r.data),
  start: (id) => api.post(`/battles/${id}/start`).then((r) => r.data),
  nextRound: (id) => api.post(`/battles/${id}/rounds/next`).then((r) => r.data),
  logs: (id) => api.get(`/battles/${id}/logs`).then((r) => r.data),
};
