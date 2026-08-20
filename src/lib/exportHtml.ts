// Build brief §4: "Export writes a self-contained HTML file with edits
// baked in as inline styles." The sheet itself (PedigreeSheet) is styled
// entirely with inline `style` props rather than Tailwind classes, so its
// live DOM is already self-contained — this just wraps that markup in a
// minimal standalone document.

export function buildExportHtml(sheetOuterHTML: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  * { box-sizing: border-box; }
  .fill { color: #dc2626; font-style: italic; }
  .pedigree-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  @media print {
    .pedigree-box button { display: none; }
  }
</style>
</head>
<body>
${sheetOuterHTML}
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
