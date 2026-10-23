import { routeUserQuery } from "../lib/intentRouter";

const tests = [
  "Google Chrome kholo",
  "Chrome kholo",
  "VLC kholo",
  "open notepad",
  "Notepad kholo",
  "Chrome band karo",
  "navigate to https://en.wikipedia.org in chrome",
  "scroll down in chrome",
  "refresh chrome",
  "what is on chrome",
];

for (const t of tests) {
  const res = routeUserQuery(t, undefined, []);
  console.log(`Query: "${t}" -> Tool: ${res.toolRequired || res.intent}, Params: ${JSON.stringify(res.toolParams || {})}`);
}

