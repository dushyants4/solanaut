// Archived records, verified as a stream: framing, the hash chain, and any head, digest or anchor
// pinned from outside. It does not authenticate history that nothing pins, replay a policy or
// recover state.

export type ArchiveErrorCode =
  | "input"
  | "source"
  | "framing"
  | "record"
  | "chain"
  | "changed-source"
  | "head"
  | "digest"
  | "anchor";
export class ArchiveError extends Error {
  readonly code: ArchiveErrorCode;
  constructor(code: ArchiveErrorCode, message: string) {
    super(message);
    this.name = "ArchiveError";
    this.code = code;
  }
}
export interface ArchiveOptions {
  firstSeq?: number;
  previousHead?: string;
  expectedHead?: string;
  expectedDigest?: string;
  maxLineBytes?: number;
  expectedAnchor?: { seq: number; head: string };
}
export interface ArchiveReceipt {
  entries: number;
  firstSeq: number;
  nextSeq: number;
  head: string;
  sha256: string;
  bytes: number;
  anchor?: { seq: number; head: string };
}
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const kinds = new Set(["decision", "report", "release", "redeem", "policy", "signing", "request", "response"]);
function record(line: Buffer, seq: number, previous: string): Entry {
  if (line.length === 0) throw new ArchiveError("framing", "archive contains an empty line");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(line);
  } catch {
    throw new ArchiveError("framing", "archive contains invalid UTF-8");
  }
  let entry: Entry;
  try {
    entry = JSON.parse(text) as Entry;
  } catch {
    throw new ArchiveError("record", "archive contains invalid JSON");
  }
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    entry.v !== 1 ||
    !kinds.has(entry.kind) ||
    !Number.isSafeInteger(entry.seq) ||
    entry.seq < 0 ||
    !Number.isFinite(entry.at) ||
    entry.at < 0 ||
    !hex(entry.hash) ||
    (entry.prev !== "" && !hex(entry.prev))
  )
    throw new ArchiveError("record", "archive record envelope is unsupported or malformed");
  let hash: string;
  try {
    hash = hashOf(entry);
  } catch {
    throw new ArchiveError("record", "archive record cannot be canonicalised");
  }
  if (entry.seq !== seq || entry.prev !== previous || entry.hash !== hash)
    throw new ArchiveError("chain", "archive hash chain or sequence differs");
  return entry;
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) immutable(item);
    Object.freeze(value);
  }
  return value;
}
/** Internal iterator: yields are provisional until natural completion verifies all pins. */
export function streamArchive(
  path: string,
  options: ArchiveOptions = {},
): AsyncGenerator<Readonly<Entry>, Readonly<ArchiveReceipt>, void> {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some(
      (key) =>
        !["firstSeq", "previousHead", "expectedHead", "expectedDigest", "maxLineBytes", "expectedAnchor"].includes(key),
    )
  )
    throw new ArchiveError("input", "archive options are invalid");
  const {
    firstSeq = 0,
    previousHead: previous = "",
    maxLineBytes: maxLine = 1_048_576,
    expectedHead,
    expectedDigest,
  } = options;
  const expectedAnchor = options.expectedAnchor,
    anchorSeq = expectedAnchor?.seq,
    anchorHead = expectedAnchor?.head;
  if (
    typeof path !== "string" ||
    !path ||
    !Number.isSafeInteger(firstSeq) ||
    firstSeq < 0 ||
    (firstSeq === 0 ? previous !== "" : !hex(previous)) ||
    !Number.isSafeInteger(maxLine) ||
    maxLine < 1 ||
    maxLine > 16_777_216 ||
    (expectedHead !== undefined && expectedHead !== "" && !hex(expectedHead)) ||
    (expectedDigest !== undefined && !hex(expectedDigest))
  )
    throw new ArchiveError("input", "archive options are invalid");
  if (
    expectedAnchor !== undefined &&
    (!expectedAnchor ||
      typeof expectedAnchor !== "object" ||
      Array.isArray(expectedAnchor) ||
      Object.keys(expectedAnchor).some((key) => !["seq", "head"].includes(key)) ||
      !Number.isSafeInteger(anchorSeq) ||
      anchorSeq! < firstSeq ||
      !hex(anchorHead))
  )
    throw new ArchiveError("input", "archive anchor pin is invalid");
  if (process.platform !== "linux") throw new ArchiveError("source", "archive verification supports local Linux files");
  return (async function* () {
    try {
      const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(Number.MAX_SAFE_INTEGER))
          throw new ArchiveError("source", "archive must be a regular file with one link and a supported size");
        const chunk = Buffer.allocUnsafe(65_536),
          digest = createHash("sha256");
        let pending = Buffer.alloc(0),
          bytes = 0,
          nextSeq = firstSeq,
          head = previous;
        let anchorMatched = false;
        while (bytes < Number(before.size)) {
          const read = await handle.read(chunk, 0, Math.min(chunk.length, Number(before.size) - bytes), null);
          if (read.bytesRead === 0) throw new ArchiveError("changed-source", "archive ended before its declared size");
          bytes += read.bytesRead;
          digest.update(chunk.subarray(0, read.bytesRead));
          pending = Buffer.concat([pending, chunk.subarray(0, read.bytesRead)]);
          let start = 0,
            end: number;
          while ((end = pending.indexOf(10, start)) !== -1) {
            if (end - start > maxLine)
              throw new ArchiveError("framing", "archive line exceeds the configured byte limit");
            if (nextSeq === Number.MAX_SAFE_INTEGER)
              throw new ArchiveError("chain", "archive sequence exceeds the safe integer range");
            const entry = record(pending.subarray(start, end), nextSeq, head);
            head = entry.hash;
            if (nextSeq === anchorSeq) {
              if (head !== anchorHead)
                throw new ArchiveError("anchor", "archive differs from the externally pinned anchor");
              anchorMatched = true;
            }
            nextSeq++;
            start = end + 1;
            yield immutable(entry);
          }
          pending = pending.subarray(start);
          if (pending.length > maxLine)
            throw new ArchiveError("framing", "archive line exceeds the configured byte limit");
        }
        if (pending.length !== 0) throw new ArchiveError("framing", "archive lacks its final newline");
        if (expectedAnchor !== undefined && !anchorMatched)
          throw new ArchiveError("anchor", "archive does not contain the externally pinned anchor");
        const after = await handle.stat({ bigint: true }),
          named = await fs.lstat(path, { bigint: true });
        if (
          before.size !== after.size ||
          before.mtimeNs !== after.mtimeNs ||
          before.ctimeNs !== after.ctimeNs ||
          after.nlink !== 1n ||
          !named.isFile() ||
          named.ino !== before.ino ||
          named.dev !== before.dev
        )
          throw new ArchiveError("changed-source", "archive changed during verification");
        const sha256 = digest.digest("hex");
        if (expectedHead !== undefined && head !== expectedHead)
          throw new ArchiveError("head", "archive head differs from the external pin");
        if (expectedDigest !== undefined && sha256 !== expectedDigest)
          throw new ArchiveError("digest", "archive bytes differ from the external digest");
        return immutable({
          entries: nextSeq - firstSeq,
          firstSeq,
          nextSeq,
          head,
          sha256,
          bytes,
          ...(expectedAnchor === undefined ? {} : { anchor: { seq: anchorSeq!, head: anchorHead! } }),
        });
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error instanceof ArchiveError) throw error;
      throw new ArchiveError("source", "archive read could not complete");
    }
  })();
}
export async function verifyArchive(path: string, options: ArchiveOptions = {}): Promise<ArchiveReceipt> {
  const iterator = streamArchive(path, options);
  for (;;) {
    const next = await iterator.next();
    if (next.done) return structuredClone(next.value);
  }
}
// Structural archive integrity only. Policy/state validity still requires authenticated replay.
import fs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { hashOf, type Entry } from "./log.ts";
