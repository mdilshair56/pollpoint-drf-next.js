import React from "react";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      {children}
    </main>
  );
}
