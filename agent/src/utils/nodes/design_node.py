from langchain_ollama import ChatOllama
from src.utils.state import AgentState, Scene
import json

# 初始化模型
model = ChatOllama(model="gemma4:26b", model_kwargs={"format": "json"})

def design_node(state: AgentState):
    """
    前期开发节点：负责从用户需求生成文学剧本，并解构为分子级的分镜 JSON。
    """
    user_prompt = state["messages"][-1].content
    
    # 1. 模拟 LayoutGPT 推理逻辑：将剧本转化为结构化坐标
    system_prompt = """
    你是一位电影工业构图专家。请根据用户的需求，生成一段 1-2 场景的剧本，
    并为每个场景提供结构化的 Bbox 坐标 [x, y, width, height]。
    输出必须是纯 JSON 格式：
    {
      "script": "剧本全文",
      "scenes": [
        {"id": "s1", "description": "描述", "layout_bbox": [0.1, 0.2, 0.8, 0.5]}
      ]
    }
    """
    
    response = model.invoke([
        ("system", system_prompt),
        ("human", user_prompt)
    ])
    
    try:
        data = json.loads(response.content)
        return {
            "script": data.get("script", ""),
            "scenes": data.get("scenes", []),
            "current_scene_index": 0,
            "is_approved": False
        }
    except Exception as e:
        # 降级处理
        return {
            "script": "解析剧本失败，请重试。",
            "scenes": [],
            "current_scene_index": 0
        }
