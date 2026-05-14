"use client";

import dynamic from "next/dynamic";

// 使用动态导入，禁用 SSR，防止 "window is not defined" 错误
// Using dynamic import with SSR disabled to prevent "window is not defined" error
const EditorContent = dynamic(() => import("./EditorContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-gray-500 animate-pulse">Loading editor...</div>
    </div>
  ),
});

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <EditorContent />
    </div>
  );
}
