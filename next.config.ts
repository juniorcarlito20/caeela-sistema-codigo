import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Opções futuras entram aqui */

  // Permite testar pelo celular/tablet na rede local durante o desenvolvimento
  // (acesso via IP em vez de "localhost"). Não existe em produção — lá o
  // domínio é fixo e o Next.js nem aplica essa checagem.
  allowedDevOrigins: ['192.168.1.154'],
};

export default nextConfig;
