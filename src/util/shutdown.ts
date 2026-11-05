type ShutdownTask = () => Promise<void> | void;

interface DestroyableClient {
  destroy: () => Promise<void> | void;
}

const shutdownTasks: ShutdownTask[] = [];
let shutdownPromise: Promise<void> | null = null;

export function registerShutdownTask(task: ShutdownTask): void {
  shutdownTasks.push(task);
}

export function requestShutdown(
  exitCode: number,
  client?: DestroyableClient
): Promise<void> {
  if (shutdownPromise !== null) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    const forceExitTimer = setTimeout(() => {
      process.exit(exitCode);
    }, 10_000);

    try {
      if (client !== undefined) {
        try {
          await client.destroy();
        } catch {
          // Best-effort teardown; continue closing the rest of the resources.
        }
      }

      for (const task of shutdownTasks) {
        try {
          await task();
        } catch {
          // Best-effort teardown; a failing cleanup task should not block exit.
        }
      }
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  })();

  return shutdownPromise;
}
