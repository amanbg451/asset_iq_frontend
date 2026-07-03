import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject(error);
    }

    const status = error.response.status;
    const message = error.response?.data?.detail || error.message;

    if (status === 401) {
      localStorage.removeItem("access_token");

      if (typeof window !== "undefined") {
        const isLoginPage = window.location.pathname.includes("/login");
        if (!isLoginPage) {
          toast.error("Session expired. Please login again.");
          window.location.href = "/login";
        }
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      const errorMsg = message.toLowerCase();
      if (errorMsg.includes("subscription") || errorMsg.includes("expired")) {
        toast.error("Your subscription has expired. Please contact support.");
        if (typeof window !== "undefined") {
          window.location.href = "/subscription-expired";
        }
      } else {
        toast.error("You don't have permission to perform this action.");
      }
      return Promise.reject(error);
    }

    if (status === 422) {
      toast.error(message);
      return Promise.reject(error);
    }

    if (status >= 500) {
      toast.error("Server error. Please try again later.");
      return Promise.reject(error);
    }

    toast.error(message);
    return Promise.reject(error);
  },
);

export default api;
