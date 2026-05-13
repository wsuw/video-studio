import os
import contextlib
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from dotenv import load_dotenv

# 加载环境变量
load_dotenv("../.env")


@contextlib.asynccontextmanager
async def generate_checkpointer():
    """使用连接字符串直接创建 Saver，它会自动处理连接池和事务问题"""
    db_uri = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URI")

    if not db_uri:
        raise ValueError("Please set DATABASE_URL or POSTGRES_URI in your .env file")

    # from_conn_string 会自动管理连接池
    async with AsyncPostgresSaver.from_conn_string(db_uri) as saver:
        # setup() 在这里运行不会再报事务错误
        await saver.setup()
        yield saver
