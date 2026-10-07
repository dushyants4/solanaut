// Execution control only: no test filtering, changed instrumentation or lower floors.
export function coverageTestArguments(argv: readonly string[]): string[] {
  if (argv.length === 0) return [];
  if (argv.length === 1 && argv[0] === "--serial") return ["--test-concurrency=1"];
  throw new Error("usage: node evals/ci/coverage-run.ts [--serial]");
}
