import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://assetai.leadtech.in/api",
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

// Helper function to format 422 validation errors
export function formatValidationError(error: any): string {
  const detail = error?.response?.data?.detail;
  
  if (!detail) return "Validation error";
  
  // If detail is a string, return it directly
  if (typeof detail === "string") return detail;
  
  // If detail is an array of validation errors
  if (Array.isArray(detail)) {
    const messages: string[] = detail
      .map((d: any) => {
        // Get the field name from loc array
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : "";
        return d?.msg ? `${field ? field + ": " : ""}${d.msg}` : null;
      })
      .filter((msg): msg is string => msg !== null);
    
    return messages.length > 0 ? messages[0] : "Validation error";
  }
  
  // If detail is an object with msg
  if (typeof detail === "object" && detail.msg) {
    return detail.msg;
  }
  
  return "Validation error";
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject(error);
    }

    const status = error.response.status;

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
      const message = error.response?.data?.detail || "";
      const errorMsg = typeof message === "string" ? message.toLowerCase() : "";
      
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
      // Format the validation error properly
      const errorMessage = formatValidationError(error);
      toast.error(errorMessage);
      return Promise.reject(error);
    }

    if (status >= 500) {
      toast.error("Server error. Please try again later.");
      return Promise.reject(error);
    }

    const message = error.response?.data?.detail || error.message;
    toast.error(typeof message === "string" ? message : "An error occurred");
    return Promise.reject(error);
  },
);

export default api;