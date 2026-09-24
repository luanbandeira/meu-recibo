const TIME_ZONE = "America/Sao_Paulo";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE });

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value)).replace(",", " às");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}
