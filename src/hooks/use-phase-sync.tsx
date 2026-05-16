import { useAgent } from "@copilotkit/react-core/v2";
import { useEffect } from "react";

/**
 * Hook to synchronize the agent's phase based on the current page.
 * Only updates `current_phase` in the shared AgentState.
 *
 * @param phase The phase to synchronize (e.g., 'design', 'breakdown', 'storyboard', 'generate', 'redesign')
 */
export function usePhaseSync(phase: string) {
  const { agent } = useAgent({ agentId: "default" });

  useEffect(() => {
    if (!agent) return;

    if (agent.state?.current_phase !== phase) {
      agent.setState({
        ...agent.state,
        current_phase: phase,
      });
    }
  }, [phase, agent]);
}
