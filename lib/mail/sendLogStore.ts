import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "lib", "mail", "send-log.json");
const MAX_ENTRIES = 2000; // cap file growth — this is a stopgap until it moves to a real DB

export interface SendLogEntry {
  msgNum: number;
  subject: string;
  category: string;
  domainId: string | null;
  recipientEmail: string;
  recipientName?: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
}

export function readSendLog(): SendLogEntry[] {
  try {
    const raw = fs.readFileSync(LOG_PATH, "utf-8");
    return JSON.parse(raw) as SendLogEntry[];
  } catch {
    return [];
  }
}

export function appendSendLog(entries: SendLogEntry[]): void {
  if (entries.length === 0) return;
  const updated = [...readSendLog(), ...entries].slice(-MAX_ENTRIES);
  fs.writeFileSync(LOG_PATH, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}
