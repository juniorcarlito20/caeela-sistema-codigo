import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAEELA — Sistema de Gestão",
  description:
    "Sistema de gestão do Centro de Atendimento Educacional Especializado de Licínio de Almeida – BA",
};

export default function RaizLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
