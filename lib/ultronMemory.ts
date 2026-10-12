/**
 * ULTRON 5-Layer Personal Memory Engine
 * 
 * Layer 1: Working Context (Active session buffer)
 * Layer 2: User Preferences & Style (Learned with confidence score)
 * Layer 3: Project State, Decisions & Goals
 * Layer 4: Workflows & Learned Corrections (Past failures / user corrections)
 * Layer 5: Verified Knowledge & Past Research
 */

export interface MemoryEntry {
  id: string;
  layer: 1 | 2 | 3 | 4 | 5;
  category: string;
  key: string;
  value: string;
  confidence: number; // 0.0 to 1.0
  source?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  summary: string;
  timestamp: number;
}

import fs from "fs";
import path from "path";

// 5 Separate Stores
// Layer 1 is in-memory session working context (ephemeral per session)
const layer1WorkingContext: ConversationTurn[] = [];

// Layers 2 to 5 are persistently stored on the local machine
const layer2UserPreferences = new Map<string, MemoryEntry>();
const layer3ProjectState = new Map<string, MemoryEntry>();
const layer4WorkflowCorrections = new Map<string, MemoryEntry>();
const layer5VerifiedResearch = new Map<string, MemoryEntry>();

// Pending memory reset confirmation
let pendingResetToken: { token: string; expiresAt: number } | null = null;

function getMemoryFilePath(): string {
  if (process.env.LOCALAPPDATA) {
    const dir = path.join(process.env.LOCALAPPDATA, "ULTRON", "memory");
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, "ultron_memory.json");
    } catch {}
  }
  return path.join(process.cwd(), "ultron_memory_store.json");
}

function persistToDisk(): void {
  try {
    const filePath = getMemoryFilePath();
    const data = {
      version: "2.0",
      savedAt: new Date().toISOString(),
      layer2: Array.from(layer2UserPreferences.values()),
      layer3: Array.from(layer3ProjectState.values()),
      layer4: Array.from(layer4WorkflowCorrections.values()),
      layer5: Array.from(layer5VerifiedResearch.values()),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ultronMemory] Failed to write persistent memory to disk:", err);
  }
}

function loadFromDisk(): void {
  try {
    const filePath = getMemoryFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.layer2)) {
        for (const item of data.layer2) layer2UserPreferences.set(item.key, item);
      }
      if (Array.isArray(data.layer3)) {
        for (const item of data.layer3) layer3ProjectState.set(item.key, item);
      }
      if (Array.isArray(data.layer4)) {
        for (const item of data.layer4) {
          const slug = item.key.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
          layer4WorkflowCorrections.set(slug, item);
        }
      }
      if (Array.isArray(data.layer5)) {
        for (const item of data.layer5) {
          const slug = item.key.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
          layer5VerifiedResearch.set(slug, item);
        }
      }
    }
  } catch (err) {
    console.warn("[ultronMemory] Failed to load persistent memory from disk:", err);
  }
}

// Initial Seeds if fresh
const now = new Date().toISOString();
layer2UserPreferences.set("owner", {
  id: "pref_owner",
  layer: 2,
  category: "identity",
  key: "owner",
  value: "Ashish",
  confidence: 1.0,
  createdAt: now,
  updatedAt: now,
});

layer2UserPreferences.set("preferred_language", {
  id: "pref_lang",
  layer: 2,
  category: "communication",
  key: "preferred_language",
  value: "Hinglish and English",
  confidence: 0.95,
  createdAt: now,
  updatedAt: now,
});

layer3ProjectState.set("active_project", {
  id: "proj_ultron",
  layer: 3,
  category: "software_engineering",
  key: "active_project",
  value: "ULTRON Holographic AI Operating System",
  confidence: 1.0,
  createdAt: now,
  updatedAt: now,
});

// Load persistent data from disk on initialization (survives app restarts)
loadFromDisk();

export const ultronMemory = {
  // Layer 1: Working Context
  recordTurn(role: "user" | "assistant", content: string, summary: string = ""): void {
    layer1WorkingContext.push({
      role,
      content,
      summary,
      timestamp: Date.now(),
    });
    if (layer1WorkingContext.length > 50) {
      layer1WorkingContext.shift();
    }
  },

  getWorkingContext(limit: number = 10): ConversationTurn[] {
    return layer1WorkingContext.slice(-limit);
  },

  // Layer 2: User Preferences
  savePreference(key: string, value: string, category: string = "general", confidence: number = 0.9): MemoryEntry {
    const existing = layer2UserPreferences.get(key);
    const entry: MemoryEntry = {
      id: existing?.id || `pref_${Date.now()}`,
      layer: 2,
      category,
      key,
      value,
      confidence,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    layer2UserPreferences.set(key, entry);
    persistToDisk();
    return entry;
  },

  // Layer 3: Project State
  saveProjectState(key: string, value: string, category: string = "architecture"): MemoryEntry {
    const existing = layer3ProjectState.get(key);
    const entry: MemoryEntry = {
      id: existing?.id || `proj_${Date.now()}`,
      layer: 3,
      category,
      key,
      value,
      confidence: 1.0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    layer3ProjectState.set(key, entry);
    persistToDisk();
    return entry;
  },

  // Layer 4: Learned Corrections & Workflows
  recordCorrection(triggerPhrase: string, correctDirective: string, category: string = "user_correction"): MemoryEntry {
    const slug = triggerPhrase.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
    const existing = layer4WorkflowCorrections.get(slug);
    const entry: MemoryEntry = {
      id: existing?.id || `corr_${Date.now()}`,
      layer: 4,
      category,
      key: triggerPhrase,
      value: correctDirective,
      confidence: 1.0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    layer4WorkflowCorrections.set(slug, entry);
    persistToDisk();
    return entry;
  },

  // Layer 5: Verified Research
  saveVerifiedResearch(topic: string, findings: string, sourceUrl?: string): MemoryEntry {
    const slug = topic.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
    const existing = layer5VerifiedResearch.get(slug);
    const entry: MemoryEntry = {
      id: existing?.id || `res_${Date.now()}`,
      layer: 5,
      category: "research",
      key: topic,
      value: findings,
      confidence: 0.98,
      source: sourceUrl,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    layer5VerifiedResearch.set(slug, entry);
    persistToDisk();
    return entry;
  },

  // Auto-Learn Corrections from User Dialog
  processPotentialCorrection(userText: string): MemoryEntry | null {
    const lower = userText.toLowerCase().trim();
    // Patterns for corrections and identity updates
    const correctionMatch =
      lower.match(/(?:actually|no[, ]+it is not|correction|wrong[, ]+use|instead of .* use|yaad rakhna ki|mera naam .* hai)[,:\s]+\s*(.*)/i) ||
      lower.match(/^(?:no|nahi|galat)[,:\s]+(.*)/i) ||
      lower.match(/(?:my name is|call me|mera naam)\s+([a-zA-Z]+)/i);

    if (correctionMatch) {
      const directive = (correctionMatch[1] || "").trim();
      if (directive.length >= 2) {
        // Check if user is specifying their name or identity preference
        const nameMatch = userText.match(/(?:my name is|mera naam|call me)\s+([a-zA-Z]+)/i);
        if (nameMatch) {
          return this.savePreference("owner", nameMatch[1], "identity", 1.0);
        }
        return this.recordCorrection(userText.slice(0, 40), directive, "direct_user_feedback");
      }
    }
    return null;
  },

  // Fast Multi-Layer Retrieval (<250ms)
  retrieveContext(query: string, limit: number = 6): string {
    const q = query.toLowerCase();
    const matched: string[] = [];

    // Search Layer 4 first (Corrections override everything)
    for (const corr of layer4WorkflowCorrections.values()) {
      if (corr.key.toLowerCase().includes(q) || corr.value.toLowerCase().includes(q)) {
        matched.push(`[CORRECTION/FIX]: When handling "${corr.key}", strictly follow: "${corr.value}"`);
      }
    }

    // Search Layer 2 (User Preferences)
    for (const pref of layer2UserPreferences.values()) {
      if (pref.key.toLowerCase().includes(q) || pref.value.toLowerCase().includes(q) || q.includes(pref.key.toLowerCase())) {
        matched.push(`[USER PREFERENCE]: ${pref.key} = ${pref.value} (Confidence: ${Math.round(pref.confidence * 100)}%)`);
      }
    }

    // Search Layer 3 (Project State)
    for (const proj of layer3ProjectState.values()) {
      if (proj.key.toLowerCase().includes(q) || proj.value.toLowerCase().includes(q)) {
        matched.push(`[PROJECT STATE]: ${proj.key}: ${proj.value}`);
      }
    }

    // Search Layer 5 (Verified Research)
    for (const res of layer5VerifiedResearch.values()) {
      if (res.key.toLowerCase().includes(q) || res.value.toLowerCase().includes(q)) {
        matched.push(`[VERIFIED RESEARCH]: ${res.key} (${res.source || "web"}): ${res.value}`);
      }
    }

    return matched.slice(0, limit).join("\n");
  },

  searchAll(query: string): Array<{ layer: number; key: string; value: string; category: string }> {
    const q = query.toLowerCase();
    const results: Array<{ layer: number; key: string; value: string; category: string }> = [];

    const check = (m: Map<string, MemoryEntry>) => {
      for (const item of m.values()) {
        if (item.key.toLowerCase().includes(q) || item.value.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)) {
          results.push({ layer: item.layer, key: item.key, value: item.value, category: item.category });
        }
      }
    };

    check(layer4WorkflowCorrections);
    check(layer2UserPreferences);
    check(layer3ProjectState);
    check(layer5VerifiedResearch);

    return results;
  },

  // Security Gate: Confirmation Token Validation for Memory Wipe
  requestResetConfirmation(): { requiresConfirmation: true; token: string; prompt: string } {
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    pendingResetToken = {
      token,
      expiresAt: Date.now() + 120_000, // 2 minutes
    };
    return {
      requiresConfirmation: true,
      token,
      prompt: `⚠️ High-Risk Action: Memory wipe cannot be undone. Please confirm by replying with confirmation token ${token} to proceed.`,
    };
  },

  confirmReset(token: string): { success: boolean; message: string } {
    if (!pendingResetToken || Date.now() > pendingResetToken.expiresAt) {
      pendingResetToken = null;
      return {
        success: false,
        message: "Memory reset confirmation token has expired or is invalid. Please request a new confirmation.",
      };
    }

    if (pendingResetToken.token !== token.trim().toUpperCase()) {
      return {
        success: false,
        message: "Invalid confirmation token. Memory reset aborted for security.",
      };
    }

    pendingResetToken = null;
    layer1WorkingContext.length = 0;
    layer2UserPreferences.clear();
    layer3ProjectState.clear();
    layer4WorkflowCorrections.clear();
    layer5VerifiedResearch.clear();
    persistToDisk();

    return {
      success: true,
      message: "All 5 layers of persistent memory and working context have been securely cleared, sir.",
    };
  },

  // General legacy helper compatibility
  saveFact(key: string, value: string, category: string = "user_preference") {
    return this.savePreference(key, value, category, 1.0);
  },

  searchFacts(query: string, limit: number = 5) {
    const all = this.searchAll(query).slice(0, limit);
    return all.map((item) => ({
      fact_key: item.key,
      fact_value: item.value,
      category: item.category,
      layer: item.layer,
    }));
  },
};
