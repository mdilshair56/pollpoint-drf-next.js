
"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={10}
      containerStyle={{
        top: 20,
        right: 20,
      }}
      toastOptions={{
        // Default settings for every notification.
        duration: 4000,
        removeDelay: 300,

        // General appearance.
        style: {
          background: "#FFFFFF",
          color: "#0F172A",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "12px 16px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
          fontSize: "14px",
          lineHeight: "20px",
          maxWidth: "min(420px, calc(100vw - 32px))",
        },

        // Successful operations.
        success: {
          duration: 3500,
          iconTheme: {
            primary: "#16A34A",
            secondary: "#F0FDF4",
          },
          ariaProps: {
            role: "status",
            "aria-live": "polite",
          },
        },

        // Failed operations.
        error: {
          duration: 5500,
          iconTheme: {
            primary: "#DC2626",
            secondary: "#FEF2F2",
          },
          ariaProps: {
            role: "alert",
            "aria-live": "assertive",
          },
        },

        // Loading operations.
        loading: {
          duration: Infinity,
          iconTheme: {
            primary: "#1E3A8A",
            secondary: "#EFF6FF",
          },
        },
      }}
    />
  );
}
