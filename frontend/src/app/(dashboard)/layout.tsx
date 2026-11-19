import { ProtectedArea } from "@/components/dashboard/protected-area";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedArea>{children}</ProtectedArea>;
}
