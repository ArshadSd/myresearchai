import type { Message } from "@/hooks/useMessages";

export function generateChatPdf(messages: Message[], title: string) {
  // Build HTML content for the PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
    h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 30px; }
    .message { margin-bottom: 20px; padding: 15px; border-radius: 12px; }
    .user { background: #0891b2; color: white; margin-left: 60px; }
    .assistant { background: #f0f4f8; margin-right: 60px; }
    .role { font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; opacity: 0.7; }
    .content { white-space: pre-wrap; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>📄 ${title}</h1>
  <p class="meta">Generated on ${new Date().toLocaleString()} · ${messages.length} messages</p>
  ${messages
    .map(
      (m) =>
        `<div class="message ${m.role}"><div class="role">${m.role}</div><div class="content">${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>`
    )
    .join("")}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
