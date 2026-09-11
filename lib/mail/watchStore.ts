import fs from "fs";
import path from "path";

const STATE_PATH = path.join(process.cwd(), "lib", "mail", "watch-state.json");

export interface WatchState {
  /** Mailbox message count as of the last time we sent an alert (or first ever check). */
  lastAlertedCount: number;
  /** Most recent time we polled the mailbox, regardless of whether it crossed the threshold. */
  lastCheckedAt: string;
  /** Most recent time an alert was actually sent. */
  lastAlertedAt: string | null;
}

export function readWatchState(): WatchState | null {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    return JSON.parse(raw) as WatchState;
  } catch {
    return null;
  }
}

export function writeWatchState(state: WatchState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
