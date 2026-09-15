import { getSupabase } from "../db/supabaseClient";

export interface WatchState {
  /** Mailbox message count as of the last time we sent an alert (or first ever check). */
  lastAlertedCount: number;
  /** Most recent time we polled the mailbox, regardless of whether it crossed the threshold. */
  lastCheckedAt: string;
  /** Most recent time an alert was actually sent. */
  lastAlertedAt: string | null;
}

export async function readWatchState(): Promise<WatchState | null> {
  const { data, error } = await getSupabase().from("mail_watch_state").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`감시 상태 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    lastAlertedCount: data.last_alerted_count,
    lastCheckedAt: data.last_checked_at,
    lastAlertedAt: data.last_alerted_at,
  };
}

export async function writeWatchState(state: WatchState): Promise<void> {
  const { error } = await getSupabase()
    .from("mail_watch_state")
    .upsert(
      {
        id: 1,
        last_alerted_count: state.lastAlertedCount,
        last_checked_at: state.lastCheckedAt,
        last_alerted_at: state.lastAlertedAt,
      },
      { onConflict: "id" }
    );
  if (error) throw new Error(`감시 상태 저장 실패: ${error.message}`);
}
