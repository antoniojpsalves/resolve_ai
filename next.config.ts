import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Exigido pelo estágio `runner` do Dockerfile multi-stage do Dia 4: o
  // build standalone empacota só o necessário para rodar `node server.js`,
  // sem precisar copiar `node_modules` inteiro para a imagem final.
  output: 'standalone',
};

export default nextConfig;
