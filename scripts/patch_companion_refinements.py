path = "lib/intentRouter.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Fix 1: DEC-001 conflict regex
old_conflict_regex = r'/\b(?:use (?:openai|gpt-4|claude|gemini cloud|chatgpt)|cloud api|external api|remote llm)\b/i'
new_conflict_regex = r'/\b(?:use|call|connect to|integrate|send to|switch to)\s+(?:openai|gpt-4|claude|gemini|chatgpt)\b|\b(?:cloud api|external api|remote llm)\b/i'

code = code.replace(old_conflict_regex, new_conflict_regex)

# Fix 2: TELEMETRY_PATTERNS regex
old_telemetry = r'/\b(system kaisa hai|system kaisa chal raha hai|kya chal raha hai)\b/i,'
new_telemetry = r'''/\b(system kaisa hai|system kaisa chal raha hai|kya chal raha hai)\b/i,
  /\b(?:system|hardware)\s+(?:ka\s+)?(?:status|hardware|performance|kaisa\s+hai|kaisa\s+chal\s+raha\s+hai)\b/i,
  /\b(?:hardware|system)\s+kaisa\s+chal\s+raha\s+hai\b/i,'''

code = code.replace(old_telemetry, new_telemetry)

with open(path, "w", encoding="utf-8") as f:
    f.write(code)
print("SUCCESS: intentRouter.ts updated.")

