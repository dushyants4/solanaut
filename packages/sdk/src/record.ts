// Where the record lives (ADR-010). A store holds the entries in order and appends one at a
// time; the guard applies an entry only after the store has kept it.
//
// The file store keeps one canonical JSON entry per line, and syncs each line to disk before the
// guard answers. On open it verifies every line: it parses, and its hash is its own. A last line
// with no newline is a write a crash cut short; it was never acknowledged, so it is cut off. Any
// other damage refuses to open: a guard that cannot trust its record does not run.
//
// One writer per record: a lock file beside it names the process that holds it. A second guard
// refuses to open while that process lives; a lock whose process is gone is taken over. The
// takeover is not atomic: two processes restarting at the same instant could both take a stale
// lock. Run one guard per record.

import { closeSync, existsSync, fsyncSync, ftruncateSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { hostname } from "node:os";
import { canonicalJSON } from "./canonical.ts";
import { hashOf, type Entry } from "./log.ts";

export interface EntryStore {
  /** Every entry kept so far, oldest first. The store, not the guard, adds to it. */
  readonly entries: Entry[];
  /** Keep one entry, durably, before returning. Throws if it cannot. */
  append(entry: Entry): void;
  close(): void;
}

/** A store in memory: the default, and what tests use. Nothing survives the process. */
export function memoryStore(): EntryStore {
  const entries: Entry[] = [];
  return { entries, append: (e) => void entries.push(e), close: () => {} };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function lock(path: string): string {
  const lockPath = `${path}.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), at: Date.now() }));
      fsyncSync(fd);
      closeSync(fd);
      return lockPath;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    let holder: { pid?: unknown; host?: unknown } = {};
    try {
      holder = JSON.parse(readFileSync(lockPath, "utf8"));
    } catch {
      // An unreadable lock is still a lock: refuse below.
    }
    if (typeof holder.pid !== "number" || typeof holder.host !== "string") {
      throw new Error(`the record ${path} has a lock file, ${lockPath}, that names no process: if no guard is running on this record, delete the lock file and start again`);
    }
    if (holder.host !== hostname() || alive(holder.pid)) {
      throw new Error(`the record ${path} is locked by process ${holder.pid} on ${holder.host}: one guard writes a record at a time`);
    }
    unlinkSync(lockPath);
  }
  throw new Error(`the record ${path} is locked, and the stale lock could not be taken over`);
}

function readRecord(path: string, fd: number): Entry[] {
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const end = text.lastIndexOf("\n") + 1;
  if (end < text.length) {
    // A torn last line: cut it, so the next entry starts on a clean line.
    ftruncateSync(fd, Buffer.byteLength(text.slice(0, end), "utf8"));
    fsyncSync(fd);
  }
  const entries: Entry[] = [];
  const lines = text.slice(0, end).split("\n").slice(0, -1);
  lines.forEach((line, i) => {
    let e: Entry;
    try {
      e = JSON.parse(line) as Entry;
    } catch {
      throw new Error(`the record ${path} is damaged: line ${i + 1} is not JSON`);
    }
    if (e === null || typeof e !== "object" || typeof e.hash !== "string" || hashOf(e) !== e.hash) {
      throw new Error(`the record ${path} is damaged: the hash of line ${i + 1} does not match its entry`);
    }
    entries.push(e);
  });
  return entries;
}

/** Open (or create) a record file, taking its lock. */
export function fileStore(path: string): EntryStore {
  const lockPath = lock(path);
  let fd: number;
  let entries: Entry[];
  try {
    fd = openSync(path, "a+");
    entries = readRecord(path, fd);
  } catch (e) {
    unlinkSync(lockPath);
    throw e;
  }
  let open = true;
  return {
    entries,
    append(entry) {
      if (!open) throw new Error("the record is closed");
      writeSync(fd, `${canonicalJSON(entry)}\n`);
      fsyncSync(fd);
      entries.push(entry);
    },
    close() {
      if (!open) return;
      open = false;
      closeSync(fd);
      try {
        const holder = JSON.parse(readFileSync(lockPath, "utf8"));
        if (holder.pid === process.pid) unlinkSync(lockPath);
      } catch {
        // Already gone.
      }
    },
  };
}
