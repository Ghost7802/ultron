/**
 * ULTRON Question Understanding & Task Context Engine
 * Re-exports the standalone QuestionUnderstandingEngine and types from intentRouter
 * for clean modular import compatibility.
 */

export {
  QuestionUnderstandingEngine,
  type StructuredTaskContext,
  type ConversationalTurn,
} from "./intentRouter";
