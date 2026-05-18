from src.state import AgentState


def generation_node(state: AgentState):
    """
    正式摄制节点：将锁定的 Bbox 坐标翻译为引擎参数并执行渲染。
    在工业流程中，这一步通常通过 MCP 调用 ComfyUI 等算力集群。
    """
    scenes = state.get("scenes", [])
    if not scenes:
        return {"messages": [("ai", "没有找到可生成的场景。")]}

    # 模拟渲染过程
    rendered_scenes = []
    for scene in scenes:
        new_scene = scene.copy()
        new_scene["status"] = "rendered"
        rendered_scenes.append(new_scene)

    return {
        "scenes": rendered_scenes,
        "messages": [
            ("ai", f"已完成 {len(rendered_scenes)} 个分镜的渲染。进入质检阶段。")
        ],
    }
