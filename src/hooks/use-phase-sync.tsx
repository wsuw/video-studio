import { useAgent } from "@copilotkit/react-core/v2";
import { useEffect } from "react";

/**
 * Hook to automatically synchronize the agent's phase based on the current page.
 * @param phase The phase to synchronize (e.g., 'design', 'storyboard', 'generate', 'redesign')
 */
export function usePhaseSync(phase: string) {
  const { agent } = useAgent({ agentId: "default" });

  useEffect(() => {
    if (agent && agent.state?.current_phase !== phase) {
      agent.setState({
        ...agent.state,
        current_phase: phase,
        next_agent: phase
      });
    }
  }, [phase, agent]);
}
