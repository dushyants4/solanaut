// Owned bounded descriptors for signer configuration and key loading; diagnostics contain no input.
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
export function readProtectedJSON(path: string, mode: 0o400 | 0o600, ceiling: number): unknown {
  let fd: number | undefined;
  let bytes: Buffer | undefined;
  try {
    if (!isAbsolute(path) || resolve(path) !== path) throw new Error();
    const parent = dirname(path),
      directory = lstatSync(parent);
    if (
      !directory.isDirectory() ||
      directory.uid !== process.getuid?.() ||
      (directory.mode & 0o777) !== 0o700 ||
      realpathSync(parent) !== parent
    )
      throw new Error();
    const before = lstatSync(path);
    if (
      !before.isFile() ||
      before.uid !== process.getuid?.() ||
      before.nlink !== 1 ||
      (before.mode & 0o777) !== mode ||
      before.size > ceiling
    )
      throw new Error();
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(fd);
    bytes = Buffer.alloc(ceiling + 1);
    let length = 0;
    if (opened.ino !== before.ino || opened.dev !== before.dev) throw new Error();
    while (length < bytes.length) {
      const n = readSync(fd, bytes, length, bytes.length - length, null);
      if (n === 0) break;
      length += n;
    }
    const after = fstatSync(fd),
      current = lstatSync(path),
      parentAfter = lstatSync(parent);
    if (
      length > ceiling ||
      length !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      current.ino !== opened.ino ||
      current.dev !== opened.dev ||
      current.nlink !== 1 ||
      (current.mode & 0o777) !== mode ||
      current.uid !== before.uid ||
      parentAfter.ino !== directory.ino ||
      parentAfter.dev !== directory.dev ||
      parentAfter.uid !== directory.uid ||
      (parentAfter.mode & 0o777) !== 0o700 ||
      realpathSync(parent) !== parent
    )
      throw new Error();
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw new Error("protected input unavailable");
  } finally {
    bytes?.fill(0);
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        throw new Error("protected input unavailable");
      }
    }
  }
}
