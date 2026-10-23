import { routeUserQuery } from "../lib/intentRouter";

const testQueries = [
  "Google Chrome kholo aur Wikipedia open karo.",
  "Ab batao page par kya likha hai.",
  "Page ko neeche scroll karo, phir batao kya badla.",
  "Notepad kholo aur ek harmless test sentence likho.",
  "open application",
  "file delete karo"
];

for (const q of testQueries) {
  const r = routeUserQuery(q);
  console.log("==========================================");
  console.log(`QUERY: "${q}"`);
  console.log(`INTENT: ${r.intent}`);
  console.log(`TOOL: ${r.toolRequired || "N/A"}`);
  console.log(`PLAN GOAL: ${r.planGoal || "N/A"}`);
  console.log(`FAST RESPONSE: ${r.fastLocalResponse || "N/A"}`);
  console.log(`CONFIDENCE: ${r.confidence}`);
  console.log(`REASON: ${r.reason}`);
}

