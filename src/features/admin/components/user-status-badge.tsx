import { Badge } from "@/components/ui/badge";
import type { AdminUserRow } from "../queries";

type Props = { user: Pick<AdminUserRow, "status" | "must_change_password" | "last_sign_in_at"> };

export function UserStatusBadge({ user }: Props) {
  if (user.status === "disabled") return <Badge tone="danger">Desativado</Badge>;
  if (user.must_change_password) {
    return <Badge tone="warning">{user.last_sign_in_at ? "Senha redefinida" : "Aguardando primeiro acesso"}</Badge>;
  }
  return <Badge tone="success">Ativo</Badge>;
}
