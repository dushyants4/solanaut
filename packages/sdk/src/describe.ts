// A web3.js Transaction, reduced to a Proposal: the programs it calls, and the SOL it moves
// through the System Program. Any other program's instructions are named, never decoded, so
// the policy's program allowlist decides whether they may run at all.

import { SystemInstruction, SystemProgram, type Transaction } from "@solana/web3.js";
import type { Proposal } from "./policy.ts";

export function describeTransaction(tx: Transaction, at: number): Proposal {
  const programIds = [...new Set(tx.instructions.map((ix) => ix.programId.toBase58()))];
  const transfers: Proposal["transfers"] = [];
  for (const ix of tx.instructions) {
    if (!ix.programId.equals(SystemProgram.programId)) continue;
    if (SystemInstruction.decodeInstructionType(ix) !== "Transfer") continue;
    const { toPubkey, lamports } = SystemInstruction.decodeTransfer(ix);
    transfers.push({ to: toPubkey.toBase58(), lamports: Number(lamports) });
  }
  return { programIds, transfers, at };
}
