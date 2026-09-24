import Image from "next/image";
import logo from "@/assets/brand/meurecibo-logo.png";

// Logo oficial (mascote + "MeuRecibo"), com fundo transparente — feita para
// fundos claros, que é o que o sistema usa. Os ícones (aba do navegador e
// celular) ficam em src/app: favicon.ico, icon.png e apple-icon.png.

const HEIGHTS = { md: 44, lg: 88 } as const;

export function BrandMark({ size = "md", className = "" }: { size?: keyof typeof HEIGHTS; className?: string }) {
  const height = HEIGHTS[size];
  return (
    <Image
      src={logo}
      alt="MeuRecibo"
      height={height}
      width={Math.round((logo.width / logo.height) * height)}
      priority
      className={`w-auto ${className}`}
      style={{ height }}
    />
  );
}
