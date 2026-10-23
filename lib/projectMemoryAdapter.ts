/**
 * ULTRON Project Memory Adapter (QuantumX Integration)
 * 
 * Enforces the strict rule: QuantumX is the ONLY permitted user project in memory.
 * Bridges into QuantumXMemoryEngine and ultronMemory.
 */

import { ultronMemory, type MemoryEntry } from "./ultronMemory";
import {
  QuantumXMemoryEngine,
  type QuantumXMemoryRecord,
  type QuantumXRecordType,
  type QuantumXRecordStatus,
} from "./quantumxMemory";

export {
  QuantumXMemoryEngine,
  type QuantumXMemoryRecord,
  type QuantumXRecordType,
  type QuantumXRecordStatus,
};

export class ProjectMemoryAdapter {
  /**
   * Records a structured memory item strictly in the QuantumX namespace.
   */
  static recordProjectMemory(record: {
    projectId?: string;
    classification?: string;
    category: "preference" | "decision" | "architecture" | "bug" | "plan" | "lesson_learned";
    title: string;
    details: string;
    rationale?: string;
    source?: string;
    confidence?: number;
    verified?: boolean;
  }): QuantumXMemoryRecord {
    // If projectId is given, it MUST be QuantumX
    const targetProject = record.projectId || "QuantumX";
    if (targetProject !== "QuantumX") {
      throw new Error(`QuantumX Memory Boundary Violation: Only 'QuantumX' is permitted. Write rejected for '${targetProject}'.`);
    }

    const typeMap: Record<string, QuantumXRecordType> = {
      decision: "decision",
      architecture: "fact",
      bug: "issue",
      plan: "task",
      lesson_learned: "fact",
      preference: "fact",
    };

    return QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: typeMap[record.category] || "fact",
      status: record.verified ? "verified_complete" : "approved",
      content: `${record.title}: ${record.details}`,
      source: record.source || "user_dialogue",
      evidence: record.rationale,
      confidence: record.confidence ?? 1.0,
    });
  }

  /**
   * Records a user-confirmed preference in Layer 2 (Personal Store).
   */
  static recordUserConfirmedFact(key: string, value: string, category: string = "general"): MemoryEntry {
    return ultronMemory.savePreference(key, value, category, 1.0);
  }

  /**
   * Records a lesson learned into QuantumX memory.
   */
  static recordLessonLearned(projectId: string, title: string, lesson: string, evidence: string): QuantumXMemoryRecord {
    if (projectId !== "QuantumX") {
      throw new Error(`QuantumX Memory Boundary Violation: Cannot record lesson for '${projectId}'. Only 'QuantumX' is allowed.`);
    }

    return QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "fact",
      status: "verified_complete",
      content: `[LESSON LEARNED] ${title}: ${lesson}`,
      source: "verified_test_outcome",
      evidence,
      confidence: 1.0,
    });
  }

  /**
   * Inspects all active QuantumX memories.
   */
  static inspectMemories(filter?: { category?: string }): QuantumXMemoryRecord[] {
    return QuantumXMemoryEngine.getRecords();
  }

  /**
   * Corrects an existing QuantumX memory.
   */
  static correctMemory(memoryId: string, updatedDetails: string): boolean {
    return QuantumXMemoryEngine.correctRecord(memoryId, updatedDetails);
  }

  /**
   * Permanently deletes a QuantumX memory with tombstone protection.
   */
  static deleteMemory(memoryKeyOrId: string): boolean {
    return QuantumXMemoryEngine.deleteRecord(memoryKeyOrId);
  }
}
