import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

// Request interceptor - adds token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles errors globally
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      toast.error("Session expired. Please login again.");
      window.location.href = "/login";
    }
    
    // Handle 403 Forbidden - could be subscription expiry (Rule 1 & 8)
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.detail || "";
      if (errorMessage.toLowerCase().includes("subscription") || 
          errorMessage.toLowerCase().includes("expired")) {
        toast.error("Your subscription has expired. Please contact support.");
        window.location.href = "/subscription-expired";
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;