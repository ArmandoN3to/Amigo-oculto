import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Amigo oculto da família",
    template: "%s | Amigo oculto da família",
  },
  description:
    "Um encontro em família, sugestões de presentes e um sorteio cheio de carinho.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
