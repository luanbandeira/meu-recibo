import Link from "next/link";
import { endSupport } from "../actions";
import type { SupportSession } from "../session";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Faixa do modo suporte, presa ao topo junto com o cabeçalho (AppHeader).
 * Sempre visível: no ambiente do usuário (quem
 * está sendo visto, somente leitura, até quando) e na área admin (lembrete de
 * que há uma sessão aberta).
 */
export function SupportBanner({ support, area }: { support: SupportSession; area: "app" | "admin" }) {
  return (
    <div role="region" aria-label="Modo de suporte" className="bg-amber-400 text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Modo de suporte:</span> {support.targetName}
          <span className="font-medium"> — somente leitura</span>
          <span className="whitespace-nowrap"> · até {timeFormat.format(new Date(support.expiresAt))}</span>
        </p>
        <div className="flex items-center gap-2">
          {area === "admin" && (
            <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-lg px-3 font-medium underline hover:bg-amber-300">
              Voltar ao ambiente
            </Link>
          )}
          <form action={endSupport}>
            <button type="submit" className="min-h-10 whitespace-nowrap rounded-lg bg-amber-950 px-3 font-medium text-amber-50 hover:bg-amber-900">
              <span className="sm:hidden">Encerrar</span>
              <span className="hidden sm:inline">Sair do modo de suporte</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
