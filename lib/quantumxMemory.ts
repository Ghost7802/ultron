/**
 * QuantumX Project-Scoped Memory Contract & Boundary Engine
 * 
 * NON-NEGOTIABLE SCOPE RULE:
 * QuantumX is the ONLY user project allowed in persistent project memory.
 * All writes for other project namespaces are strictly rejected.
 * Ambiguous project writes are quarantined.
 * ULTRON runtime context and diagnostics are strictly separated into ULTRON_INTERNAL namespace.
 */

import { ultronMemory, type MemoryEntry } from "./ultronMemory";

export type QuantumXRecordType =
  | "fact"
  | "decision"
  | "hypothesis"
  | "suggestion"
  | "task"
  | "milestone"
  | "issue"
  | "session_summary";

export type QuantumXRecordStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "superseded"
  | "unresolved"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "verified_complete";

export interface QuantumXMemoryRecord {
  project_id: "QuantumX";
  record_id: string;
  record_type: QuantumXRecordType;
  status: QuantumXRecordStatus;
  content: string;
  source: string;
  evidence?: string;
  created_at: string;
  updated_at: string;
  confidence: number; // 0.0 to 1.0
  supersedes_record_id?: string;
  deletion_state: "active" | "tombstone";
  wasConsolidated?: boolean;
}

const SENSITIVE_CREDENTIAL_PATTERN =
  /password|passwd|api[_-]?key|bearer|sk-[a-zA-Z0-9_-]+|ghp_[a-zA-Z0-9]+|BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY/i;

export class QuantumXMemoryEngine {
  /**
   * Persists a record into QuantumX memory, strictly enforcing project boundaries and credential protection.
   */
  static saveRecord(record: {
    project_id: string;
    record_id?: string;
    record_type: QuantumXRecordType;
    status: QuantumXRecordStatus;
    content: string;
    source: string;
    evidence?: string;
    confidence?: number;
    supersedes_record_id?: string;
  }): QuantumXMemoryRecord {
    // 1. Enforce strict single-tenant user project boundary
    if (!record.project_id || typeof record.project_id !== "string") {
      this.quarantineAmbiguousRecord(record, "Missing project_id");
      throw new Error("QuantumX Memory Boundary Violation: project_id is required.");
    }

    if (record.project_id.trim() !== "QuantumX") {
      throw new Error(
        `QuantumX Memory Boundary Violation: Only 'QuantumX' is permitted in user project memory. Write rejected for '${record.project_id}'.`
      );
    }

    // 2. Reject sensitive credentials
    if (
      SENSITIVE_CREDENTIAL_PATTERN.test(record.content) ||
      (record.evidence && SENSITIVE_CREDENTIAL_PATTERN.test(record.evidence))
    ) {
      throw new Error("Security Violation: Cannot store sensitive credentials in QuantumX project memory.");
    }

    // 3. Guardrail: Decision promotion requires explicit user authorization
    if (record.record_type === "decision" && record.status === "approved") {
      const srcLower = (record.source || "").toLowerCase();
      const isUnverifiedAssistant =
        srcLower.includes("assistant") ||
        srcLower.includes("suggestion") ||
        srcLower === "ai_inference" ||
        srcLower === "unverified" ||
        srcLower === "automated";
      const hasUserAuth =
        srcLower.includes("user") ||
        (record.evidence && /user_approved|explicit_user_approval|user_confirmed/i.test(record.evidence));

      if (isUnverifiedAssistant && !hasUserAuth) {
        throw new Error(
          "Decision Promotion Violation: Assistant suggestion cannot be promoted to approved decision without explicit user authorization."
        );
      }
    }

    const now = new Date().toISOString();

    // 4. Deduplication & Consolidation: Check if an identical active record already exists
    const normalizedContent = record.content.trim().toLowerCase().replace(/\s+/g, " ");
    const existingActive = this.getRecords().find(
      (r) =>
        r.record_type === record.record_type &&
        r.content.trim().toLowerCase().replace(/\s+/g, " ") === normalizedContent &&
        (!record.record_id || r.record_id === record.record_id)
    );

    if (existingActive) {
      existingActive.confidence = Math.max(existingActive.confidence, record.confidence ?? 1.0);
      if (record.evidence && !existingActive.evidence?.includes(record.evidence)) {
        existingActive.evidence = existingActive.evidence
          ? `${existingActive.evidence}; ${record.evidence}`
          : record.evidence;
      }
      if (record.status && record.status !== existingActive.status) {
        existingActive.status = record.status;
      }
      existingActive.updated_at = now;
      existingActive.wasConsolidated = true;
      ultronMemory.saveProjectState(`qx_${existingActive.record_id}`, JSON.stringify(existingActive), existingActive.record_type);
      return existingActive;
    }

    const recordId = record.record_id || `qx_rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 5. If superseding a prior record, mark the previous record superseded
    if (record.supersedes_record_id) {
      const existing = this.getRecordById(record.supersedes_record_id);
      if (existing) {
        existing.status = "superseded";
        existing.updated_at = now;
        ultronMemory.saveProjectState(`qx_${existing.record_id}`, JSON.stringify(existing), existing.record_type);
      }
    }

    const fullRecord: QuantumXMemoryRecord = {
      project_id: "QuantumX",
      record_id: recordId,
      record_type: record.record_type,
      status: record.status,
      content: record.content,
      source: record.source,
      evidence: record.evidence,
      created_at: now,
      updated_at: now,
      confidence: typeof record.confidence === "number" ? record.confidence : 1.0,
      supersedes_record_id: record.supersedes_record_id,
      deletion_state: "active",
      wasConsolidated: false,
    };

    ultronMemory.saveProjectState(`qx_${recordId}`, JSON.stringify(fullRecord), record.record_type);
    return fullRecord;
  }

  /**
   * Quarantines an ambiguous or untrusted memory write into Inbox isolation.
   */
  static quarantineAmbiguousRecord(rawRecord: any, reason: string): void {
    const topic = `quarantine_${Date.now()}`;
    ultronMemory.saveCandidateFact(
      topic,
      JSON.stringify({ raw: rawRecord, quarantine_reason: reason, quarantined_at: new Date().toISOString() }),
      "memory_boundary_gate",
      "untrusted"
    );
  }

  /**
   * Retrieves active QuantumX records matching optional filters.
   */
  static getRecords(filter?: {
    record_type?: QuantumXRecordType;
    status?: QuantumXRecordStatus;
  }): QuantumXMemoryRecord[] {
    const rawFacts = ultronMemory.getProjectFacts();
    const activeRecords: QuantumXMemoryRecord[] = [];

    for (const fact of rawFacts) {
      if (fact.key.startsWith("qx_")) {
        try {
          const parsed = JSON.parse(fact.value) as QuantumXMemoryRecord;
          // Boundary Assertion: project_id MUST be QuantumX and deletion_state MUST be active
          if (parsed.project_id !== "QuantumX") continue;
          if (parsed.deletion_state === "tombstone") continue;
          if (filter?.record_type && parsed.record_type !== filter.record_type) continue;
          if (filter?.status && parsed.status !== filter.status) continue;
          activeRecords.push(parsed);
        } catch {
          // Ignore malformed entries
        }
      }
    }

    return activeRecords;
  }

  /**
   * Retrieves a single QuantumX record by ID.
   */
  static getRecordById(recordId: string): QuantumXMemoryRecord | null {
    const key = recordId.startsWith("qx_") ? recordId : `qx_${recordId}`;
    const rawFacts = ultronMemory.getProjectFacts();
    for (const fact of rawFacts) {
      if (fact.key === key || fact.key === `qx_${recordId}`) {
        try {
          const parsed = JSON.parse(fact.value) as QuantumXMemoryRecord;
          if (parsed.project_id === "QuantumX" && parsed.deletion_state !== "tombstone") {
            return parsed;
          }
        } catch {}
      }
    }
    return null;
  }

  /**
   * Corrects a record with verified content and updates persistent storage.
   */
  static correctRecord(recordId: string, updatedContent: string, newEvidence?: string): boolean {
    const record = this.getRecordById(recordId);
    if (!record) return false;

    if (SENSITIVE_CREDENTIAL_PATTERN.test(updatedContent) || (newEvidence && SENSITIVE_CREDENTIAL_PATTERN.test(newEvidence))) {
      throw new Error("Security Violation: Cannot store sensitive credentials in QuantumX correction.");
    }

    record.content = updatedContent;
    if (newEvidence !== undefined) record.evidence = newEvidence;
    record.updated_at = new Date().toISOString();

    ultronMemory.saveProjectState(`qx_${record.record_id}`, JSON.stringify(record), record.record_type);
    return true;
  }

  /**
   * Permanently deletes a QuantumX record using a tombstone.
   * Guarantees that rebuilds, searches, and caches never restore deleted data.
   */
  static deleteRecord(recordId: string): boolean {
    const key = recordId.startsWith("qx_") ? recordId : `qx_${recordId}`;
    const rawFacts = ultronMemory.getProjectFacts();
    let found = false;

    for (const fact of rawFacts) {
      if (fact.key === key || fact.key === `qx_${recordId}`) {
        try {
          const parsed = JSON.parse(fact.value) as QuantumXMemoryRecord;
          parsed.deletion_state = "tombstone";
          parsed.content = "[DELETED_BY_USER]";
          parsed.updated_at = new Date().toISOString();
          ultronMemory.saveProjectState(fact.key, JSON.stringify(parsed), "deleted");
          found = true;
        } catch {
          ultronMemory.saveProjectState(fact.key, "[DELETED_BY_USER]", "deleted");
          found = true;
        }
      }
    }

    return found;
  }

  /**
   * Retrieves all tombstoned records to verify that deleted data is quarantined.
   */
  static getTombstones(): QuantumXMemoryRecord[] {
    const rawFacts = ultronMemory.getProjectFacts();
    const tombstones: QuantumXMemoryRecord[] = [];
    for (const fact of rawFacts) {
      if (fact.key.startsWith("qx_")) {
        try {
          const parsed = JSON.parse(fact.value) as QuantumXMemoryRecord;
          if (parsed.project_id === "QuantumX" && parsed.deletion_state === "tombstone") {
            tombstones.push(parsed);
          }
        } catch {}
      }
    }
    return tombstones;
  }

  /**
   * Scans and consolidates existing duplicate records.
   */
  static consolidateAllDuplicates(): number {
    const records = this.getRecords();
    const seen = new Map<string, QuantumXMemoryRecord>();
    let consolidatedCount = 0;

    for (const rec of records) {
      const sig = `${rec.record_type}::${rec.content.trim().toLowerCase().replace(/\s+/g, " ")}`;
      if (seen.has(sig)) {
        const primary = seen.get(sig)!;
        primary.confidence = Math.max(primary.confidence, rec.confidence);
        if (rec.evidence && !primary.evidence?.includes(rec.evidence)) {
          primary.evidence = primary.evidence ? `${primary.evidence}; ${rec.evidence}` : rec.evidence;
        }
        primary.updated_at = new Date().toISOString();
        primary.wasConsolidated = true;
        ultronMemory.saveProjectState(`qx_${primary.record_id}`, JSON.stringify(primary), primary.record_type);
        // Tombstone duplicate
        this.deleteRecord(rec.record_id);
        consolidatedCount++;
      } else {
        seen.set(sig, rec);
      }
    }

    return consolidatedCount;
  }

  /**
   * Formats QuantumX context summary strictly from confirmed records.
   */
  static getQuantumXContextSummary(): string {
    const facts = this.getRecords({ record_type: "fact", status: "approved" });
    const decisions = this.getRecords({ record_type: "decision", status: "approved" });
    const tasks = this.getRecords({ record_type: "task", status: "in_progress" });
    const issues = this.getRecords({ record_type: "issue", status: "unresolved" });

    const lines: string[] = [
      `[PROJECT NAMESPACE]: QuantumX (Strict Single-Tenant User Project)`,
      `[CONFIRMED FACTS]: ${facts.length > 0 ? facts.map((f) => f.content).join("; ") : "Strategic AI orchestration platform ambition"}`,
      `[APPROVED DECISIONS]: ${decisions.length > 0 ? decisions.map((d) => `[${d.record_id}] ${d.content}`).join("; ") : "No confirmed architecture decisions yet (UNCONFIRMED)"}`,
      `[ACTIVE TASKS]: ${tasks.length > 0 ? tasks.map((t) => t.content).join("; ") : "Awaiting user task assignment"}`,
      `[OPEN ISSUES]: ${issues.length > 0 ? issues.map((i) => i.content).join("; ") : "None reported"}`,
    ];

    return lines.join("\n");
  }

  /**
   * Seeds initial QuantumX strategic context strictly from known evidence without inventing facts.
   */
  static bootstrapQuantumXSeed(): void {
    // 1. Confirmed Strategic Concept (Fact / Approved)
    if (!this.getRecordById("QX-STRAT-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-STRAT-001",
        record_type: "fact",
        status: "approved",
        content: "QuantumX has been discussed as a model-agnostic AI orchestration platform.",
        source: "historical_strategic_discussion",
        evidence: "User architectural briefings on multi-model routing and orchestration.",
        confidence: 1.0,
      });
    }

    // 2. Long-Term Vision (Fact / Approved)
    if (!this.getRecordById("QX-STRAT-002")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-STRAT-002",
        record_type: "fact",
        status: "approved",
        content: "Long-term vision is to evolve beyond a basic chatbot into a Personal AI Operating System or autonomous engineering/business agent.",
        source: "historical_strategic_discussion",
        evidence: "User architectural vision statements.",
        confidence: 1.0,
      });
    }

    // 3. Intended Capability Areas (Hypothesis / Proposed)
    if (!this.getRecordById("QX-CAP-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-CAP-001",
        record_type: "hypothesis",
        status: "proposed",
        content: "Intended capability areas include AI model orchestration, planning, persistent memory, tool execution, integrations, automation, and verification.",
        source: "strategic_capability_roadmap",
        evidence: "Historical strategic goals (UNCONFIRMED: Implementation pending active milestone definition).",
        confidence: 0.85,
      });
    }

    // 4. Orchestration Coordination Concept (Hypothesis / Proposed)
    if (!this.getRecordById("QX-ARCH-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-ARCH-001",
        record_type: "hypothesis",
        status: "proposed",
        content: "The concept is to let the orchestration layer coordinate AI reasoning, tools, and workflows instead of depending entirely on one model.",
        source: "historical_strategic_discussion",
        evidence: "Multi-model orchestration architecture proposal.",
        confidence: 0.85,
      });
    }

    // 5. Dual Model Component Strategy (Hypothesis / Proposed)
    if (!this.getRecordById("QX-ARCH-002")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-ARCH-002",
        record_type: "hypothesis",
        status: "proposed",
        content: "Both hosted and local AI models have been considered as possible components of the broader strategy.",
        source: "historical_strategic_discussion",
        evidence: "Hybrid deployment strategy evaluation.",
        confidence: 0.85,
      });
    }

    // 6. Quality & Development Principles (Decision / Approved)
    if (!this.getRecordById("QX-PRIN-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-PRIN-001",
        record_type: "decision",
        status: "approved",
        content: "The product should be developed with attention to architecture, reliability, security, privacy, performance, cost, usability, and maintainability.",
        source: "engineering_guidelines",
        evidence: "Core product quality attributes approved by user.",
        confidence: 0.95,
      });
    }

    // 7. Product Sequencing Preference (Suggestion / Proposed)
    if (!this.getRecordById("QX-SEQ-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-SEQ-001",
        record_type: "suggestion",
        status: "proposed",
        content: "Prefer a useful, testable initial product over implementing many features without validating their value.",
        source: "strategic_sequencing_proposal",
        evidence: "Reliability-first iterative development recommendation.",
        confidence: 0.90,
      });
    }

    // 8. Tracked Unknowns Boundary (Fact / Approved)
    if (!this.getRecordById("QX-UNCONF-001")) {
      this.saveRecord({
        project_id: "QuantumX",
        record_id: "QX-UNCONF-001",
        record_type: "fact",
        status: "approved",
        content: "Preserved Unknowns (UNCONFIRMED): Repository URL, confirmed technology stack/architecture, integrated AI providers, completion percentage, active milestone, roadmap dates, launch date, users, revenue, and customer traction are UNCONFIRMED.",
        source: "scope_boundary_audit",
        evidence: "Explicit boundary enforcement to prevent hallucination.",
        confidence: 1.0,
      });
    }
  }
}

// Bootstrap seed on load
try {
  QuantumXMemoryEngine.bootstrapQuantumXSeed();
} catch {}