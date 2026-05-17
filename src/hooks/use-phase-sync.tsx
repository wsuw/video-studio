import { useAgent } from "@copilotkit/react-core/v2";
import { useEffect } from "react";

/**
 * Hook to synchronize the agent's phase based on the current page.
 * Only updates `current_phase` in the shared AgentState.
 *
 * IMPORTANT: Waits until agent.state is loaded from the backend before
 * writing, to avoid overwriting persisted data (design, entities, etc.)
 * with an empty spread of undefined state.
 *
 * @param phase The phase to synchronize (e.g., 'design', 'breakdown', 'storyboard', 'generate', 'redesign')
 */
export function usePhaseSync(phase: string) {
  const { agent } = useAgent({ agentId: "default" });

  useEffect(() => {
    // Guard: wait until both the agent AND its state are loaded from the backend.
    // If agent.state is undefined/null, spreading it would wipe all persisted data.
    if (!agent || !agent.state) return;

    if (agent.state.current_phase !== phase) {
      agent.setState({
        ...agent.state,
        current_phase: phase,
      });
    }
  }, [phase, agent]);
}
