"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { isValidUsername, normalizeUsername, usernameToAuthEmail } from "@/features/auth/username";
import { publicEnv } from "@/lib/env";
import { clearAllDrafts } from "@/features/receipts/draft";
import { createClient } from "@/lib/supabase/browser";

function messageFor(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Usuário ou senha incorretos.";
    case "user_banned":
      return "Esta conta está desativada. Fale com o administrador.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível entrar agora. Verifique sua conexão e tente novamente.";
  }
}

// O login acontece no navegador de propósito: o rate limit do Supabase Auth é
// por IP, e pelo servidor todos os usuários dividiriam os IPs da Vercel.
export function LoginForm({ next, accountDisabled }: { next: string; accountDisabled: boolean }) {
  const router = useRouter();
  // Chegou ao login (saiu, sessão expirou ou conta desativada): nenhum rascunho
  // com dados de pacientes pode ficar para a próxima pessoa nesta aba.
  useEffect(() => clearAllDrafts(), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    accountDisabled ? "Esta conta está desativada. Fale com o administrador." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = normalizeUsername(String(form.get("username") ?? ""));
    const password = String(form.get("password") ?? "");

    if (!isValidUsername(username) || !password) {
      setError("Usuário ou senha incorretos.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username, publicEnv.authEmailDomain),
      password,
    });

    if (signInError) {
      setError(messageFor(signInError.code));
      setPending(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Usuário"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        required
      />
      <PasswordField label="Senha" name="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" fullWidth pending={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer rounded font-medium text-brand-700">Esqueci minha senha</summary>
        <p className="mt-2">
          Por segurança, a senha é redefinida pelo administrador do MeuRecibo. Peça uma nova senha
          temporária — no próximo acesso você cria a sua.
        </p>
      </details>
    </form>
  );
}
