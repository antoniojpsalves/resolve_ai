import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O estágio `runner` do Dockerfile multi-stage roda só `node server.js`,
  // sem `npm install` nem o restante da árvore de build — o modo standalone
  // empacota exatamente o subconjunto de `node_modules` e do build que o
  // servidor precisa em runtime, dispensando copiar `node_modules` inteiro
  // (que inclui devDependencies e ferramentas de build) para a imagem final.
  output: 'standalone',
};

export default nextConfig;
