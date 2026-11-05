import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { PrintHeader, PrintWatermark } from "@/components/PrintHeader";
import { PrintFooter } from "@/components/PrintFooter";
import { numberToWords } from "@/lib/numberToWords";

interface QuotePrintPreviewProps {
  quote: any;
  onBack: () => void;
  onDownloadPdf?: () => void;
}

export function QuotePrintPreview({
  quote,
  onBack,
  onDownloadPdf,
}: QuotePrintPreviewProps) {
  const documentRef = useRef<HTMLDivElement>(null);

  const formattedDate = new Date(quote.quote_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const quoteNo = `PQ-${(quote.id || "").slice(0, 8).toUpperCase()}`;
  const totalAmount = Number(quote.total_amount) || 0;
  const vatPercentage = Number(quote.vat_percentage) || 0;
  const vatAmount = Number(quote.vat_amount) || 0;
  const subtotal = totalAmount - vatAmount;

  const handlePrint = () => {
    window.print();
  };

  const addressLines = (addr: string) => {
    return addr.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ));
  };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto pb-12 print:p-0 print:m-0">
      {/* Print-specific style reset matching Authority to Sell */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .print-document-page {
            zoom: calc(100vw / 850);
            margin: 0 auto !important;
          }
        }
        @media print {
          @page { margin: 0; size: auto; }
          html, body, #root, [class*="overflow-"], [class*="h-["] {
            height: auto !important; min-height: auto !important; max-height: none !important;
            overflow: visible !important; position: static !important;
          }
          body * { visibility: hidden; }
          .print-pages-container, .print-pages-container * { visibility: visible; }
          .print-pages-container {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important; display: block !important;
          }
          .print-document-page {
            position: relative !important; width: 210mm !important; min-height: 297mm !important;
            margin: 0 auto !important; padding: 20mm !important;
            border: none !important; box-shadow: none !important; background: white !important;
            page-break-after: auto !important; break-after: auto !important;
          }
        }
      `}} />

      {/* Top Toolbar matching Authority to Sell */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button
          variant="outline"
          onClick={onBack}
          className="rounded-xl gap-2 font-medium border-white/10 hover:bg-white/5 text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Quotes
        </Button>

        <div className="flex items-center gap-2">
          {onDownloadPdf && (
            <Button
              variant="outline"
              onClick={onDownloadPdf}
              className="rounded-xl gap-2 border-white/10 hover:bg-white/5 text-white"
            >
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          )}
          <Button
            onClick={handlePrint}
            className="rounded-xl gap-2 font-bold px-6 shadow-lg shadow-lime-400/20"
            style={{ backgroundColor: "#d4ff32", color: "#000000" }}
          >
            <Printer className="w-4 h-4" /> Print Document
          </Button>
        </div>
      </div>

      {/* Document Sheet */}
      <div className="print-pages-container flex justify-center">
        <div
          ref={documentRef}
          className="print-document-page bg-white text-slate-900 rounded-2xl shadow-2xl p-10 md:p-12 relative w-full border border-slate-200"
          style={{ width: "210mm", minHeight: "297mm" }}
        >
          {/* Watermark and Header */}
          <PrintWatermark />
          <PrintHeader />

          {/* Date & Number bar */}
          <div className="flex justify-between items-end border-b border-slate-200 pb-3 mb-6">
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Reference</span>
              <p className="text-xs font-bold text-slate-700">{quote.customers?.name || "Valued Client"}</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-slate-900 uppercase">
                DATE: {formattedDate}
              </div>
              <div className="text-xs font-bold text-slate-600">
                QUOTE NO: {quoteNo}
              </div>
            </div>
          </div>

          {/* Prepared For */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs text-slate-700">
            <p className="font-black text-slate-900 uppercase tracking-wider mb-1">Prepared For:</p>
            <p className="text-sm font-black text-slate-900">{quote.customers?.name || "—"}</p>
            {quote.customers?.phone && <p className="text-slate-600 mt-0.5">Tel: {quote.customers.phone}</p>}
            {quote.customers?.email && <p className="text-slate-600 mt-0.5">Email: {quote.customers.email}</p>}
            {quote.customers?.address && (
              <p className="text-slate-600 mt-0.5">Address: {addressLines(quote.customers.address)}</p>
            )}
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-black tracking-widest uppercase text-slate-900 underline underline-offset-4">
              PROFORMA INVOICE
            </h2>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 text-left font-black text-[10px] uppercase">
                  <th className="p-3 w-12 text-center">S/N</th>
                  <th className="p-3">Description / Specification</th>
                  <th className="p-3 w-16 text-center">Unit</th>
                  <th className="p-3 w-32 text-right">Unit Price (₦)</th>
                  <th className="p-3 w-36 text-right">Total (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quote.performance_quote_items?.map((item: any, i: number) => {
                  const basePrice = Number(item.base_price) || 0;
                  const qty = Number(item.quantity) || 1;
                  const itemTotal = basePrice * qty;

                  const rawVehicleDesc = item.vehicle_description || "";
                  const vehicleHeading = rawVehicleDesc.split("\n")[0] || `${item.vehicles?.make || ""} ${item.vehicles?.model || ""}`.trim();
                  const remainingDesc = rawVehicleDesc.split("\n").slice(1).join("\n").trim();

                  return (
                    <tr key={item.id || i} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center align-top font-bold text-slate-500">{i + 1}.</td>
                      <td className="p-3 align-top">
                        <div className="font-black text-slate-900 uppercase">
                          {vehicleHeading || "VEHICLE SPECIFICATION"}
                        </div>
                        {item.vin && (
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                            VIN/Chassis: <span className="font-bold text-slate-800">{item.vin}</span>
                          </div>
                        )}
                        {remainingDesc && (
                          <div className="text-[11px] text-slate-500 whitespace-pre-line mt-1">
                            {remainingDesc}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center align-top font-bold text-slate-700">{qty}</td>
                      <td className="p-3 text-right align-top font-semibold text-slate-800">
                        ₦{basePrice.toLocaleString()}
                      </td>
                      <td className="p-3 text-right align-top font-black text-slate-900">
                        ₦{itemTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Custom Duty Table if any */}
          {quote.performance_quote_items?.some((item: any) => item.has_duty) && (
            <div className="mb-6">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Custom Duty
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-800 border-b border-slate-200 text-left font-black text-[10px] uppercase">
                      <th className="p-2.5 w-12 text-center">S/N</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 w-16 text-center">Unit</th>
                      <th className="p-2.5 w-32 text-right">Unit Price (₦)</th>
                      <th className="p-2.5 w-36 text-right">Total (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quote.performance_quote_items
                      ?.filter((item: any) => item.has_duty)
                      .map((item: any, i: number) => {
                        const dutyPrice = Number(item.duty_price) || 0;
                        const qty = Number(item.quantity) || 1;
                        const dutyTotal = dutyPrice * qty;
                        const rawDutyDesc = item.vehicle_description
                          ? item.vehicle_description.split("\n")[0]
                          : `${item.vehicles?.make || ""} ${item.vehicles?.model || ""}`.trim();

                        return (
                          <tr key={i}>
                            <td className="p-2.5 text-center font-bold text-slate-500">{i + 1}.</td>
                            <td className="p-2.5 font-bold uppercase text-slate-800">
                              CUSTOM DUTY - {rawDutyDesc}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-700">{qty}</td>
                            <td className="p-2.5 text-right font-semibold text-slate-800">
                              ₦{dutyPrice.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">
                              ₦{dutyTotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals Summary */}
          <div className="flex flex-col items-end gap-1.5 mb-6 text-xs">
            {vatPercentage > 0 && (
              <>
                <div className="flex items-center gap-8 text-slate-600">
                  <span className="font-bold uppercase">Subtotal:</span>
                  <span className="font-bold text-slate-800 w-36 text-right">
                    ₦{subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-8 text-slate-600">
                  <span className="font-bold uppercase">VAT ({vatPercentage}%):</span>
                  <span className="font-bold text-slate-800 w-36 text-right">
                    ₦{vatAmount.toLocaleString()}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center gap-8 pt-2 border-t-2 border-slate-900 mt-1">
              <span className="text-sm font-black text-slate-900 uppercase">Grand Total:</span>
              <span className="text-base font-black text-slate-900 w-36 text-right">
                ₦{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Amount in words */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
              Amount in Words:
            </span>
            <p className="font-bold text-slate-900 uppercase mt-0.5 leading-relaxed">
              {numberToWords(totalAmount).toUpperCase()}
            </p>
          </div>

          {/* Bank Payment Details */}
          {(quote.bank_name || quote.account_number || quote.account_name) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs">
              <div className="font-black text-[11px] text-slate-900 uppercase mb-2">
                Bank Payment Details:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {quote.bank_name && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Bank Name</span>
                    <span className="font-black text-slate-900">{quote.bank_name}</span>
                  </div>
                )}
                {quote.account_number && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Account Number</span>
                    <span className="font-black text-slate-900 font-mono">{quote.account_number}</span>
                  </div>
                )}
                {quote.account_name && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Account Name</span>
                    <span className="font-black text-slate-900">{quote.account_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes / Terms */}
          {quote.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs text-slate-700">
              <span className="font-black text-[11px] text-slate-900 uppercase block mb-1">
                Notes / Terms:
              </span>
              <p className="whitespace-pre-line leading-relaxed">{quote.notes}</p>
            </div>
          )}

          {/* Print Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200">
            <PrintFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
