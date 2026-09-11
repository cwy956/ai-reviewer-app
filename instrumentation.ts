export async function register() {
  // Only the Node.js runtime has POP3/fs access — skip on the Edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMailWatcher } = await import("./lib/mail/watcher");
    startMailWatcher();
  }
}
