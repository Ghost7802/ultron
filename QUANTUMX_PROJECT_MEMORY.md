# QUANTUMX — DURABLE PROJECT MEMORY & ARCHITECTURAL FOUNDATION

> **Status:** Active & Initialized  
> **Target Project Namespace:** `QuantumX`  
> **Host AI Partner:** ULTRON (Local-First Engineering Teammate)  
> **Last Verified:** October 2026  
> **Scope Rule:** Single-Tenant User Project Memory Boundary Strictly Enforced

---

## 1. Project Memory Boundary & Scope Policy

To guarantee durable, unpolluted, and verifiable context retention across engineering sessions, ULTRON maintains a strict separation between user project knowledge, personal context, and internal system operations:

| Attribute | Project Scope (`QuantumX`) | Personal Scope (`USER_PROFILE`) | Operational Scope (`ULTRON_INTERNAL`) |
| :--- | :--- | :--- | :--- |
| **Namespace** | `QuantumX` (The ONLY permitted user project) | `personalStore` (Ashish) | `ULTRON_INTERNAL` |
| **Scope Purpose** | Strategic architecture, requirements, decisions, tasks, and hypotheses for the QuantumX product. | Background, skills, interests, learning preferences, and communication style. | ULTRON's own host runtime, Win32 window management, speech servers, Ollama daemon, and HUD. |
| **Model Constraints** | **Model-Agnostic:** May orchestrate local models (Ollama, vLLM, llama.cpp) and hosted cloud APIs (OpenAI, Anthropic, Google) as required by project trade-offs. | N/A (User attributes and preferences). | **Local-Only:** Governed by `ULTRON-DEC-001`. Host assistant operations run strictly offline on `127.0.0.1` with zero cloud telemetry. |
| **UI/UX Policy** | QuantumX defines its own UI/UX, interfaces, and design patterns independently. | N/A. | Governed by `ULTRON-DEC-002`. Preserves the Three.js holographic orb and HUD for the host OS. |
| **Persistence Engine** | `lib/quantumxMemory.ts` -> Layer 3 `projectStore` (`qx_*`) with tombstone deletion. | `lib/ultronMemory.ts` -> Layer 2 `personalStore`. | `lib/ultronMemory.ts` -> Operational diagnostics, session cache, system telemetry. |

### Strict Boundary Rules
1. **Single-Tenant Namespace:** Only records with `project_id: "QuantumX"` are permitted in persistent user project memory. Any attempt to write other project names is rejected with a boundary violation error.
2. **Ambiguous Data Isolation:** Any memory write missing a valid project identifier is quarantined into the Inbox store (`candidate_facts`) and excluded from active context until verified by the user.
3. **No Unrelated Project Import:** No details from unrelated repositories or directories are indexed, summarized, or stored into QuantumX memory.
4. **Permanent Tombstone Deletion:** Deleted records are permanently marked `deletion_state: "tombstone"` with stripped content `[DELETED_BY_USER]`. Tombstones are never resurrected by search, retrieval, or index rebuilds.
5. **Credential Masking:** Raw API keys, tokens, SSH keys, and passwords are automatically blocked by the memory boundary engine before serialization.

---

## 2. Confirmed Historical Strategic Facts

The following facts are verified historical strategic context established for QuantumX:

### `[QX-STRAT-001]` Model-Agnostic AI Orchestration Platform
- **Record ID:** `QX-STRAT-001`
- **Record Type:** `fact`
- **Status:** `approved`
- **Confidence:** `1.0` (Confirmed)
- **Source:** Historical strategic discussion
- **Evidence:** User architectural briefings on multi-model routing and orchestration
- **Content:**  
  QuantumX has been discussed as a model-agnostic AI orchestration platform.

### `[QX-STRAT-002]` Long-Term Evolution Vision
- **Record ID:** `QX-STRAT-002`
- **Record Type:** `fact`
- **Status:** `approved`
- **Confidence:** `1.0` (Confirmed)
- **Source:** Historical strategic discussion
- **Evidence:** User architectural vision statements
- **Content:**  
  Its long-term vision is to evolve beyond a basic chatbot into a Personal AI Operating System or autonomous engineering/business agent.

---

## 3. Working Hypotheses & Strategic Proposals

The following items represent historical strategic goals and architectural proposals. They provide actionable structure while remaining open to user revision:

### `[QX-CAP-001]` Intended Capability Areas
- **Record ID:** `QX-CAP-001`
- **Record Type:** `hypothesis`
- **Status:** `proposed`
- **Confidence:** `0.85`
- **Source:** Strategic capability roadmap
- **Evidence:** Historical strategic goals (UNCONFIRMED: Implementation pending active milestone definition)
- **Content:**  
  Its intended capability areas include AI model orchestration, planning, persistent memory, tool execution, integrations, automation, and verification.

### `[QX-ARCH-001]` Orchestration Layer Coordination Concept
- **Record ID:** `QX-ARCH-001`
- **Record Type:** `hypothesis`
- **Status:** `proposed`
- **Confidence:** `0.85`
- **Source:** Historical strategic discussion
- **Evidence:** Multi-model orchestration architecture proposal
- **Content:**  
  The concept is to let the orchestration layer coordinate AI reasoning, tools, and workflows instead of depending entirely on one model.

### `[QX-ARCH-002]` Dual Model Component Strategy
- **Record ID:** `QX-ARCH-002`
- **Record Type:** `hypothesis`
- **Status:** `proposed`
- **Confidence:** `0.85`
- **Source:** Historical strategic discussion
- **Evidence:** Hybrid deployment strategy evaluation
- **Content:**  
  Both hosted and local AI models have been considered as possible components of the broader strategy.

### `[QX-PRIN-001]` Product Quality & Engineering Principles
- **Record ID:** `QX-PRIN-001`
- **Record Type:** `decision`
- **Status:** `approved`
- **Confidence:** `0.95`
- **Source:** Engineering guidelines
- **Evidence:** Core product quality attributes approved by user
- **Content:**  
  The product should be developed with attention to architecture, reliability, security, privacy, performance, cost, usability, and maintainability.

### `[QX-SEQ-001]` Product Sequencing Preference
- **Record ID:** `QX-SEQ-001`
- **Record Type:** `suggestion`
- **Status:** `proposed`
- **Confidence:** `0.90`
- **Source:** Strategic sequencing proposal
- **Evidence:** Reliability-first iterative development recommendation
- **Content:**  
  Prefer a useful, testable initial product over implementing many features without validating their value.

---

## 4. Preserved Unknowns & Explicit Boundaries

To ensure complete technical honesty, ULTRON explicitly marks all unverified parameters as `UNCONFIRMED`:

### `[QX-UNCONF-001]` Tracked Unknowns
- **Record ID:** `QX-UNCONF-001`
- **Record Type:** `fact`
- **Status:** `approved`
- **Confidence:** `1.0`
- **Source:** Scope boundary audit
- **Evidence:** Explicit boundary enforcement to prevent hallucination
- **Content:**  
  Preserved Unknowns (UNCONFIRMED): Repository URL, confirmed technology stack/architecture, integrated AI providers, completion percentage, active milestone, roadmap dates, launch date, users, revenue, and customer traction are UNCONFIRMED.

| Architectural Dimension | Current Status | Safe Assumption / Action Plan |
| :--- | :--- | :--- |
| **Repository URL & Layout** | `UNCONFIRMED` | Do not assume an external GitHub URL or directory layout. Query user or inspect when provided. |
| **Confirmed Technology Stack** | `UNCONFIRMED` | Do not fabricate backend or runtime choices. Evaluate trade-offs objectively when requested. |
| **Integrated AI Providers** | `UNCONFIRMED` | Do not assume specific cloud or local API endpoints are actively wired. |
| **Roadmap Completion %** | `UNCONFIRMED` | Report zero completion percentage until concrete code milestones are implemented and verified. |
| **Active Milestones / Roadmap Dates** | `UNCONFIRMED` | Do not fabricate delivery dates or sprint timelines. |
| **Users / Revenue / Traction** | `UNCONFIRMED` | No commercial traction or customer metrics exist or are fabricated. |

---

## 5. Memory Engine Schema & Persistence Contract

Every persistent QuantumX record adheres strictly to the following TypeScript contract (`lib/quantumxMemory.ts`):

```typescript
export interface QuantumXMemoryRecord {
  project_id: "QuantumX";               // Strict single-tenant namespace
  record_id: string;                     // Unique identifier (e.g., QX-STRAT-001)
  record_type:                           // Record classification
    | "fact"
    | "decision"
    | "hypothesis"
    | "suggestion"
    | "task"
    | "milestone"
    | "issue"
    | "session_summary";
  status:                                // Lifecycle state
    | "proposed"
    | "approved"
    | "rejected"
    | "superseded"
    | "unresolved"
    | "in_progress"
    | "blocked"
    | "needs_review"
    | "verified_complete";
  content: string;                       // Plain text description of the verified item
  source: string;                        // Provenance (e.g., user_briefing, pr_review, test_run)
  evidence?: string;                     // Concrete log, file path, or test proof
  created_at: string;                    // ISO-8601 timestamp
  updated_at: string;                    // ISO-8601 timestamp
  confidence: number;                    // 0.0 to 1.0 confidence score
  supersedes_record_id?: string;         // Previous record ID if this replaces older context
  deletion_state: "active" | "tombstone";// Deletion state
}
```
