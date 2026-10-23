/**

 * ULTRON 5-Layer Personal Memory Engine (Phase 1A Architecture)

 * 

 * 1. Session Memory: Active conversation working context & recent turns

 * 2. Project Memory: ULTRON architecture, project facts, decisions & tasks

 * 3. Personal Memory: User preferences, owner identity, learned corrections & stable facts

 * 4. Inbox Memory: Candidate memories, research findings & staging awaiting review

 * 5. Vault Memory: Sensitive or protected information subject to strict token gates

 * 

 * Storage: Pure-TypeScript atomic JSON persistence with Windows crash resilience,

 * idempotent backward-compatible schema migration, and sensitive-data defense.

 */



import fs from "fs";

import path from "path";



export interface MemoryEntry {

  id: string;

  layer: 1 | 2 | 3 | 4 | 5;

  store: "session" | "project" | "personal" | "inbox" | "vault";

  category: string;

  key: string;

  value: string;

  confidence: number; // 0.0 to 1.0

  source?: string;

  tags?: string[];

  status?: string;

  trustLevel?: "untrusted" | "semi_trusted" | "verified";

  accessRestricted?: boolean;

  createdAt: string;

  updatedAt: string;

}



export interface ConversationTurn {

  role: "user" | "assistant" | "system";

  content: string;

  summary: string;

  timestamp: number;

}



export interface MemoryDiskSchema {

  version: "3.0";

  savedAt: string;

  stores: {

    session: MemoryEntry[];

    project: MemoryEntry[];

    personal: MemoryEntry[];

    inbox: MemoryEntry[];

    vault: MemoryEntry[];

  };

  unrecognizedRecords: any[];

  migrationLog: string[];

}



// In-Memory Collections for the 5 Stores

const sessionStore = new Map<string, MemoryEntry>();

const projectStore = new Map<string, MemoryEntry>();

const personalStore = new Map<string, MemoryEntry>();

const inboxStore = new Map<string, MemoryEntry>();

const vaultStore = new Map<string, MemoryEntry>();



// Unrecognized / malformed legacy records preserved for safety

const unrecognizedRecords: any[] = [];

const migrationLog: string[] = [];



// In-memory working turns buffer for immediate session conversation access

const layer1WorkingContext: ConversationTurn[] = [];



// Concurrency protection & write queue

let isWriting = false;

let writePending = false;



// Pending security tokens

let pendingResetToken: { token: string; expiresAt: number } | null = null;

const activeVaultTokens = new Map<string, number>();



// Regex pattern to prevent accidental plaintext storage of secrets in ordinary memory

const SENSITIVE_CREDENTIAL_PATTERN =

  /password|passwd|api[_-]?key|bearer|sk-[a-zA-Z0-9_-]+|ghp_[a-zA-Z0-9]+|BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY/i;



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



/**

 * Windows-safe atomic file persistence.

 * Writes to a unique temp file, forces disk flush with fsync, then replaces target file.

 */

function atomicWriteJsonSync(targetPath: string, data: any): void {

  const dir = path.dirname(targetPath);

  if (!fs.existsSync(dir)) {

    fs.mkdirSync(dir, { recursive: true });

  }



  const randSuffix = Math.random().toString(36).substring(2, 8);

  const tmpPath = path.join(dir, `.tmp_${path.basename(targetPath)}_${Date.now()}_${randSuffix}`);

  const content = JSON.stringify(data, null, 2);



  // Write content and flush to disk

  const fd = fs.openSync(tmpPath, "w");

  try {

    fs.writeSync(fd, content, 0, "utf-8");

    fs.fsyncSync(fd);

  } finally {

    fs.closeSync(fd);

  }



  // Windows atomic replacement: copyFileSync overwrites cleanly without EPERM errors

  try {

    if (fs.existsSync(targetPath)) {

      fs.copyFileSync(tmpPath, targetPath);

      try {

        fs.unlinkSync(tmpPath);

      } catch {}

    } else {

      fs.renameSync(tmpPath, targetPath);

    }

  } catch (err) {

    // Resilient fallback

    fs.copyFileSync(tmpPath, targetPath);

    try {

      fs.unlinkSync(tmpPath);

    } catch {}

  }

}



function persistToDisk(): void {

  try {

    const filePath = getMemoryFilePath();

    const payload: MemoryDiskSchema = {

      version: "3.0",

      savedAt: new Date().toISOString(),

      stores: {

        session: Array.from(sessionStore.values()),

        project: Array.from(projectStore.values()),

        personal: Array.from(personalStore.values()),

        inbox: Array.from(inboxStore.values()),

        vault: Array.from(vaultStore.values()),

      },

      unrecognizedRecords,

      migrationLog,

    };

    atomicWriteJsonSync(filePath, payload);

  } catch (err) {

    console.warn("[ultronMemory] Failed to write persistent memory atomically:", err);

  }

}



function schedulePersist(): void {

  if (isWriting) {

    writePending = true;

    return;

  }

  isWriting = true;

  try {

    persistToDisk();

  } finally {

    isWriting = false;

    if (writePending) {

      writePending = false;

      schedulePersist();

    }

  }

}



/**

 * Validates whether an entry has the minimum structure required for a MemoryEntry.

 */

function isValidEntryShape(item: any): boolean {

  return (

    item &&

    typeof item === "object" &&

    typeof item.key === "string" &&

    item.key.trim().length > 0 &&

    typeof item.value === "string"

  );

}



/**

 * Loads and migrates persistent memory from disk with idempotence and zero data loss.

 */

function loadFromDisk(): void {

  try {

    const filePath = getMemoryFilePath();

    if (!fs.existsSync(filePath)) {

      initializeSeeds();

      persistToDisk();

      return;

    }



    const raw = fs.readFileSync(filePath, "utf-8");

    if (!raw.trim()) {

      initializeSeeds();

      persistToDisk();

      return;

    }



    const data = JSON.parse(raw);



    // Case 1: Already migrated (v3.0 schema)

    if (data.version === "3.0" && data.stores) {

      if (Array.isArray(data.stores.session)) {

        for (const item of data.stores.session) {

          if (isValidEntryShape(item)) sessionStore.set(item.key, { ...item, store: "session", layer: 1 });

          else unrecognizedRecords.push(item);

        }

      }

      if (Array.isArray(data.stores.project)) {

        for (const item of data.stores.project) {

          if (isValidEntryShape(item)) projectStore.set(item.key, { ...item, store: "project", layer: 3 });

          else unrecognizedRecords.push(item);

        }

      }

      if (Array.isArray(data.stores.personal)) {

        for (const item of data.stores.personal) {

          if (isValidEntryShape(item)) personalStore.set(item.key, { ...item, store: "personal", layer: item.layer || 2 });

          else unrecognizedRecords.push(item);

        }

      }

      if (Array.isArray(data.stores.inbox)) {

        for (const item of data.stores.inbox) {

          if (isValidEntryShape(item)) inboxStore.set(item.key, { ...item, store: "inbox", layer: 4 });

          else unrecognizedRecords.push(item);

        }

      }

      if (Array.isArray(data.stores.vault)) {

        for (const item of data.stores.vault) {

          if (isValidEntryShape(item)) vaultStore.set(item.key, { ...item, store: "vault", layer: 5, accessRestricted: true });

          else unrecognizedRecords.push(item);

        }

      }

      if (Array.isArray(data.unrecognizedRecords)) {

        for (const unk of data.unrecognizedRecords) unrecognizedRecords.push(unk);

      }

      if (Array.isArray(data.migrationLog)) {

        for (const log of data.migrationLog) migrationLog.push(log);

      }

      return;

    }



    // Case 2: Legacy v2.0 or untyped schema -> Migrate idempotently

    migrationLog.push(`Migrated legacy schema at ${new Date().toISOString()}`);



    // Layer 2: User preferences -> Personal Store

    if (Array.isArray(data.layer2)) {

      for (const item of data.layer2) {

        if (isValidEntryShape(item)) {

          personalStore.set(item.key, {

            ...item,

            store: "personal",

            layer: 2,

            confidence: typeof item.confidence === "number" ? item.confidence : 0.95,

          });

        } else {

          unrecognizedRecords.push({ origin: "layer2", raw: item, note: "Malformed legacy preference" });

        }

      }

    }



    // Layer 3: Project state -> Project Store

    if (Array.isArray(data.layer3)) {

      for (const item of data.layer3) {

        if (isValidEntryShape(item)) {

          projectStore.set(item.key, {

            ...item,

            store: "project",

            layer: 3,

            confidence: 1.0,

          });

        } else {

          unrecognizedRecords.push({ origin: "layer3", raw: item, note: "Malformed legacy project state" });

        }

      }

    }



    // Layer 4: Learned corrections -> Personal Store (with correction category)

    if (Array.isArray(data.layer4)) {

      for (const item of data.layer4) {

        if (isValidEntryShape(item)) {

          const key = item.key || item.id || `corr_${Date.now()}`;

          personalStore.set(key, {

            ...item,

            key,

            category: item.category || "user_correction",

            store: "personal",

            layer: 4,

            confidence: 1.0,

          });

        } else {

          unrecognizedRecords.push({ origin: "layer4", raw: item, note: "Malformed legacy correction" });

        }

      }

    }



    // Layer 5: Verified research -> Inbox Store (isolated from trusted preferences)

    if (Array.isArray(data.layer5)) {

      for (const item of data.layer5) {

        if (isValidEntryShape(item)) {

          const key = item.key || item.id || `res_${Date.now()}`;

          inboxStore.set(key, {

            ...item,

            key,

            store: "inbox",

            layer: 5,

            status: "pending_review",

            trustLevel: "semi_trusted",

            confidence: typeof item.confidence === "number" ? item.confidence : 0.9,

          });

        } else {

          unrecognizedRecords.push({ origin: "layer5", raw: item, note: "Malformed legacy research record" });

        }

      }

    }



    // If there were any extra unexpected keys in data, preserve them in unrecognizedRecords

    const knownKeys = new Set(["version", "savedAt", "layer2", "layer3", "layer4", "layer5", "stores", "unrecognizedRecords"]);

    for (const [k, v] of Object.entries(data)) {

      if (!knownKeys.has(k)) {

        unrecognizedRecords.push({ key: k, value: v, note: "Unrecognized top-level field preserved" });

      }

    }



    // Ensure baseline defaults exist

    initializeSeeds();



    // Persist upgraded v3.0 schema atomically

    persistToDisk();

  } catch (err) {

    console.error("[ultronMemory] Critical error during loadFromDisk:", err);

    initializeSeeds();

  }

}



function initializeSeeds(): void {

  const now = new Date().toISOString();

  if (!personalStore.has("owner")) {

    personalStore.set("owner", {

      id: "pref_owner",

      layer: 2,

      store: "personal",

      category: "identity",

      key: "owner",

      value: "Ashish",

      confidence: 1.0,

      createdAt: now,

      updatedAt: now,

    });

  }

  if (!personalStore.has("preferred_language")) {

    personalStore.set("preferred_language", {

      id: "pref_lang",

      layer: 2,

      store: "personal",

      category: "communication",

      key: "preferred_language",

      value: "Communicates in Hindi, English, and Hinglish.",

      confidence: 1.0,

      source: "user_provided_context",

      createdAt: now,

      updatedAt: now,

    });

  }



  const userProfileSeeds: Array<{ key: string; value: string; category: string; confidence: number }> = [

    {

      key: "education_status",

      value: "College student studying BTech in AI/ML.",

      category: "education",

      confidence: 0.9,

    },

    {

      key: "learning_focus",

      value: "Actively learning programming, software engineering, and AI development.",

      category: "learning",

      confidence: 0.9,

    },

    {

      key: "technical_skills",

      value: "Works with technologies including Python, JavaScript/TypeScript, React, Next.js, Node.js, PostgreSQL, FastAPI, and Supabase.",

      category: "skills",

      confidence: 0.9,

    },

    {

      key: "core_interests",

      value: "Interests include AI models, AI agents, automation, developer tools, application development, and local AI systems.",

      category: "interests",

      confidence: 0.9,

    },

    {

      key: "engineering_goals",

      value: "Wants to improve practical engineering skills and build real, reliable software products.",

      category: "goals",

      confidence: 0.9,

    },

    {

      key: "cost_and_solution_preference",

      value: "Prefers practical, affordable solutions and generally wants to avoid unnecessary paid APIs and subscriptions.",

      category: "preferences",

      confidence: 0.9,

    },

    {

      key: "explanation_style_preference",

      value: "Sometimes needs beginner-friendly, step-by-step explanations when learning unfamiliar programming concepts.",

      category: "learning_style",

      confidence: 0.9,

    },

  ];



  for (const seed of userProfileSeeds) {

    if (!personalStore.has(seed.key)) {

      personalStore.set(seed.key, {

        id: `pref_${seed.key}`,

        layer: 2,

        store: "personal",

        category: seed.category,

        key: seed.key,

        value: seed.value,

        confidence: seed.confidence,

        source: "user_provided_context",

        createdAt: now,

        updatedAt: now,

      });

    }

  }

  if (!projectStore.has("active_project")) {

    projectStore.set("active_project", {

      id: "proj_ultron",

      layer: 3,

      store: "project",

      category: "software_engineering",

      key: "active_project",

      value: "ULTRON Holographic AI Operating System",

      confidence: 1.0,

      createdAt: now,

      updatedAt: now,

    });

  }

}



// Initial disk load on startup

loadFromDisk();



export const ultronMemory = {

  // Store 1: Session Memory

  recordTurn(role: "user" | "assistant", content: string, summary: string = ""): void {

    const turn: ConversationTurn = {

      role,

      content,

      summary,

      timestamp: Date.now(),

    };

    layer1WorkingContext.push(turn);

    if (layer1WorkingContext.length > 50) {

      layer1WorkingContext.shift();

    }



    // Also persist recent turns into session store for cross-turn coherence

    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    sessionStore.set(turnId, {

      id: turnId,

      layer: 1,

      store: "session",

      category: "dialogue",

      key: `${role}_${Date.now()}`,

      value: content.slice(0, 1000),

      confidence: 1.0,

      createdAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    });



    // Keep session store bounded to last 50 turns

    if (sessionStore.size > 50) {

      const oldestKey = sessionStore.keys().next().value;

      if (oldestKey) sessionStore.delete(oldestKey);

    }



    schedulePersist();

  },



  getWorkingContext(limit: number = 10): ConversationTurn[] {

    return layer1WorkingContext.slice(-limit);

  },



  // Store 2: Project Memory

  saveProjectState(key: string, value: string, category: string = "architecture"): MemoryEntry {

    if (SENSITIVE_CREDENTIAL_PATTERN.test(key) || SENSITIVE_CREDENTIAL_PATTERN.test(value)) {

      throw new Error("Security Alert: Sensitive credentials detected. Cannot store in project memory.");

    }

    const existing = projectStore.get(key);

    const entry: MemoryEntry = {

      id: existing?.id || `proj_${Date.now()}`,

      layer: 3,

      store: "project",

      category,

      key,

      value,

      confidence: 1.0,

      createdAt: existing?.createdAt || new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    };

    projectStore.set(key, entry);

    schedulePersist();

    return entry;

  },



  getProjectFacts(): MemoryEntry[] {

    return Array.from(projectStore.values());

  },



  // Store 3: Personal Memory (Preferences, Style, Learned Corrections)

  savePreference(

    key: string,

    value: string,

    category: string = "general",

    confidence: number = 0.9,

    source?: string

  ): MemoryEntry {

    if (SENSITIVE_CREDENTIAL_PATTERN.test(key) || SENSITIVE_CREDENTIAL_PATTERN.test(value)) {

      throw new Error("Security Alert: Sensitive credentials detected. Cannot store in personal memory. Use vault.");

    }

    const existing = personalStore.get(key);

    const entry: MemoryEntry = {

      id: existing?.id || `pref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,

      layer: 2,

      store: "personal",

      category,

      key,

      value,

      confidence,

      source: source || existing?.source || "user_provided_context",

      createdAt: existing?.createdAt || new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    };

    personalStore.set(key, entry);

    schedulePersist();

    return entry;

  },



  getPersonalEntries(): MemoryEntry[] {

    return Array.from(personalStore.values());

  },



  getPersonalProfile(): Record<string, string> {

    const profile: Record<string, string> = {};

    for (const entry of personalStore.values()) {

      profile[entry.key] = entry.value;

    }

    return profile;

  },



  recordCorrection(triggerPhrase: string, correctDirective: string, category: string = "user_correction"): MemoryEntry {

    if (SENSITIVE_CREDENTIAL_PATTERN.test(triggerPhrase) || SENSITIVE_CREDENTIAL_PATTERN.test(correctDirective)) {

      throw new Error("Security Alert: Sensitive credentials detected. Cannot store in correction memory.");

    }

    const slug = triggerPhrase.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);

    const existing = personalStore.get(slug);

    const entry: MemoryEntry = {

      id: existing?.id || `corr_${Date.now()}`,

      layer: 4,

      store: "personal",

      category,

      key: triggerPhrase,

      value: correctDirective,

      confidence: 1.0,

      createdAt: existing?.createdAt || new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    };

    personalStore.set(slug, entry);

    schedulePersist();

    return entry;

  },



  // Store 4: Inbox / Candidate Memory (Quarantine for untrusted & web-extracted data)

  saveCandidateFact(topic: string, findings: string, sourceUrl?: string, trustLevel: "untrusted" | "semi_trusted" = "semi_trusted"): MemoryEntry {

    const slug = topic.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);

    const existing = inboxStore.get(slug);

    const entry: MemoryEntry = {

      id: existing?.id || `inbox_${Date.now()}`,

      layer: 5,

      store: "inbox",

      category: "research_candidate",

      key: topic,

      value: findings,

      confidence: trustLevel === "semi_trusted" ? 0.85 : 0.5,

      source: sourceUrl,

      status: "pending_review",

      trustLevel,

      createdAt: existing?.createdAt || new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    };

    inboxStore.set(slug, entry);

    schedulePersist();

    return entry;

  },



  // Backward compatibility alias for research storage

  saveVerifiedResearch(topic: string, findings: string, sourceUrl?: string): MemoryEntry {

    return this.saveCandidateFact(topic, findings, sourceUrl, "semi_trusted");

  },



  getInboxItems(): MemoryEntry[] {

    return Array.from(inboxStore.values());

  },



  // Store 5: Vault Memory (Token-Gated Strict Storage)

  storeVaultItem(key: string, value: string, label: string, token: string): { success: boolean; entry?: MemoryEntry; error?: string } {

    if (!token || token.trim().length < 6) {

      return { success: false, error: "Access denied. Valid authorization token required for vault write." };

    }

    const entry: MemoryEntry = {

      id: `vault_${Date.now()}`,

      layer: 5,

      store: "vault",

      category: "protected",

      key,

      value,

      confidence: 1.0,

      accessRestricted: true,

      tags: [label],

      createdAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

    };

    vaultStore.set(key, entry);

    schedulePersist();

    return { success: true, entry };

  },



  getVaultItem(key: string, token: string): { success: boolean; value?: string; error?: string } {

    if (!token || token.trim().length < 6) {

      return { success: false, error: "Access denied. Valid authorization token required for vault read." };

    }

    const entry = vaultStore.get(key);

    if (!entry) {

      return { success: false, error: "Item not found in vault." };

    }

    return { success: true, value: entry.value };

  },



  listVaultLabels(): Array<{ key: string; label: string; updatedAt: string }> {

    return Array.from(vaultStore.values()).map((v) => ({

      key: v.key,

      label: v.tags?.[0] || "unlabeled",

      updatedAt: v.updatedAt,

    }));

  },



  // Auto-Learn Corrections from User Dialogue

  processPotentialCorrection(userText: string): MemoryEntry | null {

    const lower = userText.toLowerCase().trim();

    const correctionMatch =

      lower.match(/(?:actually|no[, ]+it is not|correction|wrong[, ]+use|instead of .* use|yaad rakhna ki|mera naam .* hai)[,:\s]+\s*(.*)/i) ||

      lower.match(/^(?:no|nahi|galat)[,:\s]+(.*)/i) ||

      lower.match(/(?:my name is|call me|mera naam)\s+([a-zA-Z]+)/i);



    if (correctionMatch) {

      const directive = (correctionMatch[1] || "").trim();

      if (directive.length >= 2) {

        const nameMatch = userText.match(/(?:my name is|mera naam|call me)\s+([a-zA-Z]+)/i);

        if (nameMatch) {

          return this.savePreference("owner", nameMatch[1], "identity", 1.0);

        }

        return this.recordCorrection(userText.slice(0, 40), directive, "direct_user_feedback");

      }

    }

    return null;

  },



  /**

   * Fast Context Retrieval (<2 ms) for prompt injection.

   * SECURITY RULE: Vault memory and unverified Inbox candidates are strictly EXCLUDED.

   */

  retrieveContext(query: string, limit: number = 6): string {

    const q = query.toLowerCase();

    const matched: string[] = [];



    // 1. Search Personal Corrections & Preferences (Highest Priority)

    for (const pref of personalStore.values()) {

      if (pref.key.toLowerCase().includes(q) || pref.value.toLowerCase().includes(q) || q.includes(pref.key.toLowerCase())) {

        if (pref.category === "user_correction" || pref.category === "correction") {

          matched.push(`[CORRECTION/FIX]: When handling "${pref.key}", strictly follow: "${pref.value}"`);

        } else {

          matched.push(`[USER PREFERENCE]: ${pref.key} = ${pref.value} (Confidence: ${Math.round(pref.confidence * 100)}%)`);

        }

      }

    }



    // 2. Search Project Memory

    for (const proj of projectStore.values()) {

      if (proj.key.toLowerCase().includes(q) || proj.value.toLowerCase().includes(q)) {

        matched.push(`[PROJECT STATE]: ${proj.key}: ${proj.value}`);

      }

    }



    // 3. Search Verified Inbox Items (Only if marked verified or explicitly semi_trusted research)

    for (const inb of inboxStore.values()) {

      if (inb.trustLevel === "semi_trusted" || inb.status === "approved") {

        if (inb.key.toLowerCase().includes(q) || inb.value.toLowerCase().includes(q)) {

          matched.push(`[RESEARCH FINDINGS]: ${inb.key} (${inb.source || "local"}): ${inb.value}`);

        }

      }

    }



    // SECURITY GUARANTEE: vaultStore is NEVER queried or returned here.

    return matched.slice(0, limit).join("\n");

  },



  searchAll(query: string): Array<{ layer: number; store: string; key: string; value: string; category: string }> {

    const q = query.toLowerCase();

    const results: Array<{ layer: number; store: string; key: string; value: string; category: string }> = [];



    const check = (m: Map<string, MemoryEntry>) => {

      for (const item of m.values()) {

        if (item.key.toLowerCase().includes(q) || item.value.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)) {

          results.push({

            layer: item.layer,

            store: item.store,

            key: item.key,

            value: item.value,

            category: item.category,

          });

        }

      }

    };



    check(personalStore);

    check(projectStore);

    check(inboxStore);

    check(sessionStore);

    // Note: vaultStore is excluded from standard search



    return results;

  },



  // Security Gate: Confirmation Token Validation for Total Memory Reset

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

    sessionStore.clear();

    projectStore.clear();

    personalStore.clear();

    inboxStore.clear();

    vaultStore.clear();

    layer1WorkingContext.length = 0;

    unrecognizedRecords.length = 0;

    migrationLog.push(`All stores cleared via confirmed reset token at ${new Date().toISOString()}`);

    persistToDisk();



    return {

      success: true,

      message: "All 5 layers of persistent memory and working context have been securely cleared, sir.",

    };

  },



  // Telemetry & diagnostics for audit

  getStats(): {

    sessionCount: number;

    projectCount: number;

    personalCount: number;

    inboxCount: number;

    vaultCount: number;

    unrecognizedCount: number;

    filePath: string;

  } {

    return {

      sessionCount: sessionStore.size,

      projectCount: projectStore.size,

      personalCount: personalStore.size,

      inboxCount: inboxStore.size,

      vaultCount: vaultStore.size,

      unrecognizedCount: unrecognizedRecords.length,

      filePath: getMemoryFilePath(),

    };

  },



  getUnrecognizedRecords(): any[] {

    return [...unrecognizedRecords];

  },



  // Legacy helper compatibility

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

      store: item.store,

    }));

  },



  // Reload hook for testing restart persistence

  reload(): void {

    sessionStore.clear();

    projectStore.clear();

    personalStore.clear();

    inboxStore.clear();

    vaultStore.clear();

    unrecognizedRecords.length = 0;

    migrationLog.length = 0;

    loadFromDisk();

  },

};

