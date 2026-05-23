@echo off
cd /d "%~dp0..\agent"
npx @langchain/langgraph-cli dev --host 0.0.0.0 --port 8123 --no-browser
