// Structural archive verification only; this command never restores or writes guard state.
import { verifyArchive, ArchiveError, type ArchiveOptions } from "../src/archive.ts";
const usage = "usage: solanaut-verify-archive <archive.jsonl> [--head <hash>] [--sha256 <digest>] [--first-seq <integer>] [--previous-head <hash>] [--max-line-bytes <integer>] [--anchor-seq <integer> --anchor-head <hash>]";
function argumentsOf(args: string[]): { path: string; options: ArchiveOptions } {
  const [path, ...flags] = args;
  if (!path || path.startsWith("--") || flags.length % 2 !== 0) throw new Error("usage");
  const options: ArchiveOptions = {}, seen = new Set<string>();
  let anchorSeq:number|undefined, anchorHead:string|undefined;
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index]!, value = flags[index + 1]!;
    if (seen.has(flag)) throw new Error("usage");
    seen.add(flag);
    switch (flag) {
      case "--head": options.expectedHead = value; break;
      case "--sha256": options.expectedDigest = value; break;
      case "--previous-head": options.previousHead = value; break;
      case "--anchor-head": anchorHead=value; break;
      case "--first-seq": case "--max-line-bytes": case "--anchor-seq": {
        if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("usage");
        if (flag === "--first-seq") options.firstSeq = Number(value);
        else if(flag==="--max-line-bytes") options.maxLineBytes = Number(value);
        else anchorSeq=Number(value);
        break;
      }
      default: throw new Error("usage");
    }
  }
  if(seen.has("--anchor-seq")!==seen.has("--anchor-head")) throw new Error("usage");
  if(anchorSeq!==undefined) options.expectedAnchor={seq:anchorSeq,head:anchorHead!};
  return { path, options };
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") console.log(usage);
else {
  let input: ReturnType<typeof argumentsOf> | undefined;
  try { input = argumentsOf(args); } catch { console.error(usage); process.exitCode = 2; }
  if (input) try { console.log(JSON.stringify(await verifyArchive(input.path, input.options))); }
  catch (error) {
    if (error instanceof ArchiveError && error.code === "input") { console.error(usage); process.exitCode = 2; }
    else { console.error(JSON.stringify({ error: { code: error instanceof ArchiveError ? error.code : "source", message: error instanceof ArchiveError ? error.message : "archive verification could not complete" } })); process.exitCode = 1; }
  }
}
