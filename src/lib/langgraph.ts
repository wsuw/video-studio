/**
 * LangGraph Server API 客户端工具库
 */

const LANGGRAPH_API_URL = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:8123";

/**
 * 更新指定 Thread 的状态 (State)
 * @param threadId 会话 ID (对应 projectId)
 * @param values 要更新的状态键值对
 */
export async function updateThreadState(threadId: string, values: Record<string, any>) {
  const url = `${LANGGRAPH_API_URL}/threads/${threadId}/state`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[LangGraph] Failed to update state for thread ${threadId}:`, error);
    throw error;
  }
}

/**
 * 获取指定 Thread 的当前状态
 */
export async function getThreadState(threadId: string) {
  const url = `${LANGGRAPH_API_URL}/threads/${threadId}/state`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`[LangGraph] Failed to fetch state for thread ${threadId}:`, error);
    throw error;
  }
}
