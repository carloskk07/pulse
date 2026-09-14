function formatUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  const width = 72;
  if (line.length <= width) return line;

  const parts: string[] = [];
  let cursor = line;
  while (cursor.length > width) {
    parts.push(cursor.slice(0, width));
    cursor = ` ${cursor.slice(width)}`;
  }
  parts.push(cursor);
  return parts.join("\r\n");
}

export function buildReturnReminderCalendar(
  targetIso: string,
  returnUrl = "https://pulsercuit.pro/dashboard",
  reminderId?: string | null,
) {
  const start = new Date(targetIso);
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid return reminder target");

  const parsedReturnUrl = new URL(returnUrl);
  if (parsedReturnUrl.protocol !== "https:") throw new Error("Invalid return reminder URL");

  const end = new Date(start.getTime() + 10 * 60_000);
  const stamp = new Date();
  const targetKey = formatUtc(start);
  const uidKey = reminderId?.replace(/[^0-9a-z-]/gi, "") || targetKey;
  const summary = "Pulsercuit: next Pulse eligibility window";
  const description = "Your rolling Pulse eligibility window is opening. This reminder does not guarantee a reward; funding, safety and claim checks run again when you return.";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//Pulsercuit//Return Intelligence//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:pulsercuit-return-${uidKey}@pulsercuit.pro`,
    `DTSTAMP:${formatUtc(stamp)}`,
    `DTSTART:${targetKey}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${parsedReturnUrl.toString()}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    `DESCRIPTION:${escapeIcsText("Your Pulsercuit eligibility window is opening.")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
