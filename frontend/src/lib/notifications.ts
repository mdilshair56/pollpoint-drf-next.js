
"use client";

import { toast, type ToastOptions } from "react-hot-toast";
import type { ReactElement } from "react";

type PromiseMessages<T> = {
  loading: string;
  success: string | ((result: T) => string);
  error: string | ((error: unknown) => string);
};

const getOptions = (
  options?: ToastOptions
): ToastOptions => ({
  position: "top-right",
  ...options,
});

export const notify = {

  // Successful operation.
  success(message: string, options?: ToastOptions) {
    return toast.success(message, getOptions(options));
  },

  // Failed operation.
  error(message: string, options?: ToastOptions) {
    return toast.error(message, getOptions(options));
  },

  // Informational notification.
  info(message: string, options?: ToastOptions) {
    return toast(message, {
      ...getOptions(options),
      icon: options?.icon ?? "ℹ️",
    });
  },

  // Warning notification.
  warning(message: string, options?: ToastOptions) {
    return toast(message, {
      ...getOptions(options),
      icon: options?.icon ?? "⚠️",
      duration: options?.duration ?? 4500,
    });
  },

  // Loading notification.
  loading(message: string, options?: ToastOptions) {
    return toast.loading(message, getOptions(options));
  },

  // Automatically handles loading, success and error.
  promise<T>(
    promise: Promise<T>,
    messages: PromiseMessages<T>,
    options?: ToastOptions
  ) {
    return toast.promise(
      promise,
      messages,
      getOptions(options)
    );
  },

  // Custom JSX notification.
  custom(
    content: ReactElement | string | null,
    options?: ToastOptions
  ) {
    return toast.custom(content, getOptions(options));
  },

  // Dismiss a specific notification.
  dismiss(id?: string) {
    if (id) {
      toast.dismiss(id);
      return;
    }

    toast.dismiss();
  },

  // Dismiss all notifications.
  dismissAll() {
    toast.dismiss();
  },
};
