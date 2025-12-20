/**
 * 处理 .well-known 路径请求（如 Chrome DevTools 检测）
 * 返回空 JSON 避免控制台报错
 */
export function loader() {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

