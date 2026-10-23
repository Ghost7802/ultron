/**
 * ULTRON Desktop Application Controller
 * Re-exports DesktopApplicationController, BrowserApplicationController,
 * and related interfaces from ultronTools for modular import compatibility.
 */

export {
  DesktopApplicationController,
  BrowserApplicationController,
  resolveInstalledApplication,
  type DesktopTarget,
  type DesktopExecutionStep,
  type DesktopWorkflowResult,
} from "./ultronTools";
