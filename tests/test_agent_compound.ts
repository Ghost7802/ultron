import { ultronAgentEngine } from "../lib/ultronAgentEngine";

async function main() {
  console.log("Starting agent execution for compound goal: 'Google Chrome kholo aur Wikipedia open karo.'");
  const result = await ultronAgentEngine.runLoop("Google Chrome kholo aur Wikipedia open karo.", {
    maxIterations: 3,
    overallTimeoutMs: 90000,
  });

  console.log("AGENT LOOP STATUS:", result.status);
  console.log("AGENT STEPS EXECUTED:", result.steps.length);
  for (const s of result.steps) {
    console.log(`- Step ${s.step}: Tool '${s.tool}' -> Result Status: ${s.result.status}`);
  }
  console.log("AGENT FINAL REPLY:", result.reply);
}

main().catch(console.error);
