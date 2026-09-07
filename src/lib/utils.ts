// Sem consumidor direto (os componentes de src/components/ importam `cn`
// direto de 'cn', não daqui) — existe só porque components.json declara
// "utils": "@/lib/utils" como alias fixo do shadcn/ui; o CLI (`npx shadcn add`)
// gera novos componentes importando desse caminho, então removê-lo quebraria
// qualquer geração futura sem trocar também o alias em components.json.
export { cn } from 'cn';
