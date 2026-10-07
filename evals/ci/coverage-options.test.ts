import { strict as assert } from "node:assert";
import { test } from "node:test";
import { coverageTestArguments } from "./coverage-options.ts";
test("CI-2: default coverage execution preserves Node's test scheduling", () => {
  assert.deepEqual(coverageTestArguments([]), []);
});
test("CI-2: serial coverage requests one test process without filtering the population", () => {
  const input = ["--serial"]; assert.deepEqual(coverageTestArguments(input), ["--test-concurrency=1"]);
  assert.deepEqual(input, ["--serial"]);
});
test("CI-2: unsupported, duplicated and filtering coverage options refuse", () => {
  for (const args of [["--serial", "--serial"], ["--test-name-pattern=none"], ["--test-concurrency=0"], ["--serial=1"], ["--serial", "extra"], [""]]) assert.throws(() => coverageTestArguments(args), /usage:/);
});
