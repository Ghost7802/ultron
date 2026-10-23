# ULTRON Coding & Commenting Standards for AI Agents

> **Mandatory Rule for All Future Code**: Whenever you generate, modify, refactor, or add code anywhere in the ULTRON codebase, you must adhere strictly to these commenting and documentation standards.

---

## 1. Core Principles
1. **Explain the "Why" and the "How", Not Just the "What"**:
   - Comments should clarify design decisions, architectural trade-offs, security checks, and algorithm mechanics.
   - Avoid redundant comments that simply restate trivial syntax (e.g., do not write `// increment i by 1` next to `i++`).
2. **Beginner-Friendly & Clear**:
   - Use plain, accessible language so that new developers and learners can understand how data flows through the system.
   - Break down complex multi-step pipelines into intuitive, numbered phases.
3. **Accuracy & Synchronization**:
   - Never leave obsolete or misleading comments.
   - Whenever modifying executable code, immediately update associated comments, docstrings, and parameter descriptions.

---

## 2. File-Level Documentation
Every source file (`.ts`, `.tsx`, `.py`, `.ps1`, `.sh`, etc.) must start with a concise header block explaining:
- **Module Name & Purpose**: What this file does and what subsystem it belongs to.
- **Key Responsibilities**: Bullet points of main capabilities.
- **Architectural Role & Interactions**: How this module interfaces with other modules (e.g. Next.js API, Python voice engine, Windows UIA).
- **Safety / Security Guarantees**: e.g., read-only assertions, token gates, sandboxing.

---

## 3. Function & Class Documentation
Every significant class, interface, method, and function must include structured documentation:
- **Python**: Use Google-style or PEP 257 docstrings detailing `Args`, `Returns`, and `Raises`.
- **TypeScript / JavaScript**: Use JSDoc format (`/** ... */`) detailing `@param`, `@returns`, and `@throws`.
- **State & Side Effects**: Explicitly mention if a function touches the disk, launches child processes, sends Win32 keystrokes, or updates persistent memory.

---

## 4. Complex Logic & Control Flow
Inline comments are required for:
- **Complex Regex**: Explain what patterns are matched (e.g. Hinglish telemetry queries, Hindi phrasing).
- **Security & Authorization Checks**: Highlight confirmation token verification and boundaries.
- **Fallbacks & Error Recovery**: Explain why an alternative pathway is triggered (e.g. falling back from local Ollama to deterministic rules).
- **Low-level OS Interactions**: Document Win32 P/Invoke calls, UI Automation tree traversals, GDI screen captures, and process handles.

---

## 5. Preservation Rule
- Existing comments and docstrings must be preserved and enhanced.
- Under no circumstances should commenting tasks alter executable logic or application behavior.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
