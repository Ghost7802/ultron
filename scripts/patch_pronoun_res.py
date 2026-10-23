path = "lib/intentRouter.ts"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

target = """    // 3. Error references: "the previous error", "that error", "fix this"
    const errorRefMatch = lower.match(/\\b(?:fix|solve|explain|why did)?\\s*(?:the\\s+previous|that|this)\\s+(?:error|failure|issue|bug)\\b/i);
    if (errorRefMatch && lastAssistantMsg) {
      const errorSnippet = lastAssistantMsg.content.match(/(?:Error|Failed|Exception):\\s*([^\\n.]+)/i);
      if (errorSnippet) {
        entities.referencedTopic = errorSnippet[1].trim();
        resolved = resolved.replace(errorRefMatch[0], `the error "${errorSnippet[1].trim()}"`);
      }
    }

    return { resolvedText: resolved, entities };"""

replacement = """    // 3. Error references: "the previous error", "that error", "fix this"
    const errorRefMatch = lower.match(/\\b(?:fix|solve|explain|why did)?\\s*(?:the\\s+previous|that|this)\\s+(?:error|failure|issue|bug)\\b/i);
    if (errorRefMatch && lastAssistantMsg) {
      const errorSnippet = lastAssistantMsg.content.match(/(?:Error|Failed|Exception):\\s*([^\\n.]+)/i);
      if (errorSnippet) {
        entities.referencedTopic = errorSnippet[1].trim();
        resolved = resolved.replace(errorRefMatch[0], `the error "${errorSnippet[1].trim()}"`);
      }
    }

    // 4. Pronoun application references: "close it", "focus it", "band karo isko", "use close karo"
    const pronounAppMatch = lower.match(/\\b(?:close|focus|inspect|switch to|band karo)\\s+(?:it|this|that|isko|ise|use)\\b/i) ||
                           lower.match(/\\b(?:isko|ise|use)\\s+(?:close|band)\\s*karo\\b/i);
    if (pronounAppMatch && history.length > 0) {
      for (const msg of [...history].reverse()) {
        const appMention = msg.content.match(/\\b(chrome|google chrome|notepad|vlc|edge|calculator|explorer|code|cmd|powershell)\\b/i);
        if (appMention) {
          const matchedApp = appMention[1].toLowerCase();
          entities.targetWindow = matchedApp;
          resolved = resolved.replace(/\\b(it|this|that|isko|ise|use)\\b/i, matchedApp);
          break;
        }
      }
    }

    return { resolvedText: resolved, entities };"""

text_norm = text.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in text_norm:
    text_norm = text_norm.replace(target_norm, replacement_norm, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text_norm)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")

