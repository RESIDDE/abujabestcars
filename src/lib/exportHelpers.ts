import { toast } from "sonner";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { logAction } from "@/lib/logger";

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  logAction("EXPORT", filename, null, { format: "CSV", count: data.length });
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Header row
  csvRows.push(headers.join(","));
  
  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] ?? "")).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadFileBlob(blob, `${filename}.csv`);
}

export function exportToExcel(data: Record<string, any>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  logAction("EXPORT", filename, null, { format: "Excel", count: data.length });
  const headers = Object.keys(data[0]);
  
  // Create a simple HTML table for Excel
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /><style>
      table { border-collapse: collapse; }
      th { background-color: #f2f2f2; font-weight: bold; border: 1px solid #000; }
      td { border: 1px solid #000; }
    </style></head>
    <body><table><thead><tr>`;
  
  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });
  
  html += `</tr></thead><tbody>`;
  
  data.forEach(row => {
    html += `<tr>`;
    headers.forEach(h => {
      const val = row[h] ?? "";
      html += `<td>${val}</td>`;
    });
    html += `</tr>`;
  });
  
  html += `</tbody></table></body></html>`;
  
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  downloadFileBlob(blob, `${filename}.xls`);
}

function downloadFileBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}

export function exportToJSON(data: Record<string, any>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  logAction("EXPORT", filename, null, { format: "JSON", count: data.length });
  downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
}

export function printHTMLDocument(title: string, htmlBody: string) {
  logAction("PRINT", title, null, { title, ref: title });
  const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 25px; color: #1e293b; background: #ffffff; line-height: 1.4; }
        h1, h2, h3 { color: #0f172a; margin-top: 0; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
        th { background: #f1f5f9; font-weight: 700; color: #0f172a; text-transform: uppercase; font-size: 10px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
        .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; }
        .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; }
        .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .badge-good { background: #dcfce7; color: #166534; }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .badge-info { background: #e0f2fe; color: #075985; }
        @media print {
          @page { margin: 0; size: auto; }
          body { padding: 0; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      ${getPrintWatermarkHTML()}
      ${getPrintHeaderHTML()}
      ${htmlBody}
      ${getPrintFooterHTML()}
    </body>
    </html>
  `;

  let printed = false;
  try {
    const win = window.open("", "_blank");
    if (win && !win.closed) {
      win.document.write(fullHTML);
      win.document.close();
      setTimeout(() => {
        win.print();
      }, 400);
      printed = true;
    }
  } catch (e) {
    console.warn("Popup blocked, falling back to iframe print", e);
  }

  if (!printed) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(fullHTML);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 400);
    }
  }
}

export async function exportHTMLToPDF(title: string, filename: string, htmlBody: string) {
  toast.info("Generating PDF Document...");
  logAction("EXPORT", filename, null, { format: "PDF", title, ref: filename });
  const fullHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 25px; color: #1e293b; background: #ffffff; width: 900px; box-sizing: border-box; }
        h1, h2, h3 { color: #0f172a; margin-top: 0; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
        th { background: #f1f5f9; font-weight: 700; color: #0f172a; text-transform: uppercase; font-size: 10px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
        .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; }
        .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; }
        .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
        .badge-good { background: #dcfce7; color: #166534; }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .badge-info { background: #e0f2fe; color: #075985; }
      </style>
    </head>
    <body>
      ${getPrintHeaderHTML()}
      ${htmlBody}
      ${getPrintFooterHTML()}
    </body>
    </html>
  `;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "950px";
  container.style.background = "#ffffff";
  container.innerHTML = fullHTML;
  document.body.appendChild(container);

  try {
    await new Promise((res) => setTimeout(res, 600));
    const { toPng } = await import("html-to-image");
    const imgData = await toPng(container, { pixelRatio: 2, backgroundColor: "#ffffff" });

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${filename}.pdf`);
    toast.success("PDF Document exported successfully");
  } catch (err: any) {
    console.error("PDF export error:", err);
    toast.error("Failed to export PDF document");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export function printTable(title: string, data: Record<string, any>[], columns: { key: string; label: string }[]) {
  const tableHTML = `
    <h1 style="text-align: center; margin-top: 20px; font-size: 18px;">${title}</h1>
    <table>
      <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${data.map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
  printHTMLDocument(title, tableHTML);
}

export async function exportToPDF(title: string, data: Record<string, any>[], columns: { key: string; label: string }[]) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  
  const tableHTML = `
    <h1 style="text-align: center; margin-top: 20px; font-size: 18px;">${title}</h1>
    <table>
      <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${data.map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
  await exportHTMLToPDF(title, title.toLowerCase().replace(/\s+/g, '_'), tableHTML);
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}

