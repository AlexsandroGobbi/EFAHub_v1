import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  title: "EFAHub — Gestão e agendamentos",
  description: "Experiências conectadas de agendamento e gestão para negócios com hora marcada."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
