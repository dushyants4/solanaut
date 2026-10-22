// The MCP firewall: it selects which tool calls may reach a wallet. Anything they would sign must
// still be admitted by the guard (ADR-011).
type Reason = "configuration" | "request" | "tool" | "network";
export class McpFilterError extends Error {
  readonly code = "mcp-filter";
  readonly reason: Reason;
  constructor(reason: Reason) {
    super(
      {
        configuration: "MCP filter configuration is invalid",
        request: "MCP call is malformed or exceeds its bounds",
        tool: "MCP tool is not permitted",
        network: "MCP call requires explicit devnet",
      }[reason],
    );
    this.name = "McpFilterError";
    this.reason = reason;
  }
}
export interface FilteredToolCall {
  readonly kind: "filtered-tool-call";
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}
const supported = ["send_solana_transaction", "transfer_tokens"];
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function freeze(value: unknown, depth = 0): void {
  if (depth > 32 || (typeof value === "number" && !Number.isFinite(value))) throw new McpFilterError("request");
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child, depth + 1);
    Object.freeze(value);
  }
}
/** Internal offline filter. A selected call is neither a receipt nor permission to forward. */
export function createToolFilter(
  input: unknown,
): Readonly<{ tools: readonly string[]; select(text: unknown): Readonly<FilteredToolCall> }> {
  try {
    return buildFilter(input);
  } catch {
    throw new McpFilterError("configuration");
  }
}
function buildFilter(
  input: unknown,
): Readonly<{ tools: readonly string[]; select(text: unknown): Readonly<FilteredToolCall> }> {
  if (!object(input)) throw new McpFilterError("configuration");
  const fields = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(fields).length !== 2 ||
    Object.keys(fields).sort().join(",") !== "cluster,tools" ||
    Object.values(fields).some((field) => !Object.hasOwn(field, "value"))
  )
    throw new McpFilterError("configuration");
  const selected = fields.tools!.value;
  if (fields.cluster!.value !== "devnet" || !Array.isArray(selected)) throw new McpFilterError("configuration");
  const slots = Object.getOwnPropertyDescriptors(selected) as Record<string, PropertyDescriptor>,
    length = slots.length!.value,
    keys = Object.keys(slots).filter((key) => key !== "length");
  if (
    Reflect.ownKeys(slots).length !== length + 1 ||
    Object.values(slots).some((field) => !Object.hasOwn(field, "value")) ||
    keys.length !== length ||
    !keys.every((key, index) => key === String(index))
  )
    throw new McpFilterError("configuration");
  const values = keys.map((key) => slots[key]!.value);
  if (
    !values.every((tool) => typeof tool === "string" && supported.includes(tool)) ||
    new Set(values).size !== values.length
  )
    throw new McpFilterError("configuration");
  const tools = Object.freeze(values as string[]);
  return Object.freeze({
    tools,
    select(text: unknown): Readonly<FilteredToolCall> {
      if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 65536) throw new McpFilterError("request");
      let call: unknown;
      try {
        call = JSON.parse(text);
      } catch {
        throw new McpFilterError("request");
      }
      if (
        !object(call) ||
        Object.keys(call).sort().join(",") !== "arguments,name" ||
        typeof call.name !== "string" ||
        !object(call.arguments)
      )
        throw new McpFilterError("request");
      if (!tools.includes(call.name)) throw new McpFilterError("tool");
      // Omission defaults to mainnet upstream; never fill devnet in on the agent's behalf.
      if (!Object.hasOwn(call.arguments, "networkId") || call.arguments.networkId !== "solana:devnet")
        throw new McpFilterError("network");
      freeze(call.arguments);
      return Object.freeze({ kind: "filtered-tool-call", name: call.name, arguments: call.arguments });
    },
  });
}
