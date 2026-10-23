import re

# 1. Update lib/intentRouter.ts
router_path = "lib/intentRouter.ts"
with open(router_path, "r", encoding="utf-8") as f:
    router_code = f.read()

# Replace extractRequirements
old_extract = '''  static extractRequirements(text: string): string[] {
    // Clean initial greetings or introductory clauses
    let clean = text.replace(/^(?:hey\\s+ultron|ultron|hello|please|kripya|suno|bhai)\\s*[,:]?\\s*/i, "").trim();

    // Check if query contains sequential separators: "and also", "aur sath mein", "and then", "aur phir", ";", newline
    const separatorPattern = /\\s*(?:;\\s*|\\band\\s+also\\b|\\baur\\s+sath\\s+mein\\b|\\band\\s+then\\b|\\baur\\s+phir\\b|\\baur\\s+bhi\\b|\\n+)\\s*/i;
    let parts = clean.split(separatorPattern).map((p) => p.trim()).filter((p) => p.length > 0);

    // If only 1 part, check for conjunction " and " or " aur " when joining two distinct verb phrases
    if (parts.length === 1) {
      const verbConjunction = clean.match(/^(.+?)\\s+(?:and|aur)\\s+((?:check|list|show|open|type|inspect|search|find|batao|dekho|kholo|chalao)\\s+.+)$/i);
      if (verbConjunction) {
        parts = [verbConjunction[1].trim(), verbConjunction[2].trim()];
      }
    }

    return parts.length > 0 ? parts : [clean];
  }'''

new_extract = '''  static extractRequirements(text: string): string[] {
    // Clean initial greetings or introductory clauses
    let clean = text.replace(/^(?:hey\\s+ultron|ultron|hello|please|kripya|suno|bhai)\\s*[,:]?\\s*/i, "").trim();

    // Check if query contains sequential separators: "and also", "aur sath mein", "and then", "aur phir", ";", newline
    const separatorPattern = /\\s*(?:;\\s*|\\band\\s+also\\b|\\baur\\s+sath\\s+mein\\b|\\band\\s+then\\b|\\baur\\s+phir\\b|\\baur\\s+bhi\\b|,\\s*phir\\b|,\\s*then\\b|\\n+)\\s*/i;
    let parts = clean.split(separatorPattern).map((p) => p.trim()).filter((p) => p.length > 0);

    // If only 1 part, check for conjunction " and ", " aur ", " phir ", or " then " when joining distinct actions
    if (parts.length === 1) {
      const conjunctionMatch = clean.match(/^(.+?)\\s+(?:and|aur|phir|then)\\s+(.+)$/i);
      if (conjunctionMatch) {
        const first = conjunctionMatch[1].trim();
        const second = conjunctionMatch[2].trim();
        const actionVerbPattern = /\\b(?:check|list|show|open|type|write|inspect|search|find|batao|dekho|kholo|chalao|likho|karo|scroll|read)\\b/i;
        if (actionVerbPattern.test(first) && actionVerbPattern.test(second)) {
          parts = [first, second];
        }
      }
    }

    return parts.length > 0 ? parts : [clean];
  }'''

# Normalize CRLF
norm_code = router_code.replace("\r\n", "\n")
norm_old = old_extract.replace("\r\n", "\n")
norm_new = new_extract.replace("\r\n", "\n")

if norm_old in norm_code:
    norm_code = norm_code.replace(norm_old, norm_new, 1)
    print("Updated extractRequirements in lib/intentRouter.ts")
else:
    print("old_extract not found in lib/intentRouter.ts")

# Also add analyze_screen pattern for page reading
old_screen_match = '''  if (/\\b(?:what is on my screen|analyze (?:my )?screen|screen pe kya hai|look at (?:my )?screen|what do you see|screen dekho|describe screen)\\b/i.test(lower)) {'''
new_screen_match = '''  if (/\\b(?:what is on my screen|analyze (?:my )?screen|screen pe kya hai|look at (?:my )?screen|what do you see|screen dekho|describe screen|page (?:par|pe) kya (?:hai|likha hai)|screen (?:par|pe) kya (?:hai|likha hai)|what is (?:on|written on) (?:the |my )?(?:page|screen)|read (?:the )?(?:page|screen)|batao (?:page|screen) (?:par|pe) kya likha hai)\\b/i.test(lower)) {'''

if old_screen_match in norm_code:
    norm_code = norm_code.replace(old_screen_match, new_screen_match, 1)
    print("Updated analyze_screen regex in lib/intentRouter.ts")
else:
    print("old_screen_match not found in lib/intentRouter.ts")

with open(router_path, "w", encoding="utf-8") as f:
    f.write(norm_code)

print("Patching complete!")

