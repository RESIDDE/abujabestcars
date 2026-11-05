import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, CheckCircle2, FileText } from "lucide-react";
import { PrintHeader, PrintWatermark } from "@/components/PrintHeader";
import { PrintFooter } from "@/components/PrintFooter";
import { numberToWords } from "@/lib/numberToWords";

interface SalePrintPreviewProps {
  sale: any;
  customer?: any;
  vehicles?: any[];
  payment?: any;
  paymentIndex?: number;
  allPayments?: any[];
  onBack: () => void;
  onDownloadPdf?: () => void;
}

export function SalePrintPreview({
  sale,
  customer,
  vehicles = [],
  payment,
  paymentIndex,
  allPayments = [],
  onBack,
  onDownloadPdf,
}: SalePrintPreviewProps) {
  const documentRef = useRef<HTMLDivElement>(null);

  // Compute vehicles in this sale
  const saleVehicleIds = sale.sale_vehicles?.length > 0
    ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
    : [sale.vehicle_id];

  let saleVehicleObjects = vehicles.filter((v: any) => saleVehicleIds.includes(v.id));
  if (saleVehicleObjects.length === 0 && sale.vehicles) {
    saleVehicleObjects = Array.isArray(sale.vehicles) ? sale.vehicles : [sale.vehicles];
  }

  // Financial calculations
  const totalSalePrice = Number(sale.sale_price) || 0;
  const isPaymentReceipt = Boolean(payment);

  const paymentAmount = payment ? Number(payment.amount) || 0 : totalSalePrice;

  // Payments chronology
  let totalPaidBefore = 0;
  let totalPaidIncludingThis = totalSalePrice;
  let balance = 0;
  let isFullPayment = true;

  if (isPaymentReceipt && allPayments.length > 0) {
    totalPaidBefore = allPayments
      .filter((_: any, i: number) => i > (paymentIndex ?? 0))
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    totalPaidIncludingThis = totalPaidBefore + paymentAmount;
    balance = Math.max(0, totalSalePrice - totalPaidIncludingThis);
    isFullPayment = balance <= 0;
  }

  const receiptDate = payment?.payment_date || sale.sale_date || sale.created_at || new Date().toISOString();
  const formattedDate = new Date(receiptDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const receiptNumber = `REC-${(payment?.id || sale.id || "").slice(0, 8).toUpperCase()}`;

  const amountInWords = numberToWords(isPaymentReceipt ? paymentAmount : totalSalePrice).toUpperCase();

  const handlePrint = () => {
    window.print();
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
          @page { margin: 0; size: A4; }
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
          className="rounded-full gap-2 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sales
        </Button>

        <div className="flex items-center gap-3">
          {onDownloadPdf && (
            <Button
              variant="outline"
              onClick={onDownloadPdf}
              className="rounded-full gap-2 font-medium"
            >
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          )}

          <Button
            onClick={handlePrint}
            className="rounded-full gap-2 bg-[#d4ff32] hover:brightness-105 text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 px-6"
          >
            <Printer className="w-4 h-4" /> Print Document
          </Button>
        </div>
      </div>

      {/* Printable A4 Document Sheet */}
      <div className="print-pages-container w-full flex justify-center overflow-x-auto custom-scrollbar">
        <div
          ref={documentRef}
          className="print-document-page bg-white text-black shadow-2xl border border-gray-200 p-8 md:p-[20mm] md:w-[210mm] md:min-h-[297mm] shrink-0 relative flex flex-col justify-between"
        >
          <PrintWatermark />

          <div>
            <PrintHeader />

            {/* Document Title */}
            <div className="text-center my-3 print:my-2">
              <h1 className="text-lg print:text-base font-black text-black uppercase tracking-widest underline underline-offset-4">
                {isPaymentReceipt ? "Vehicle Sales Payment Receipt" : "Vehicle Sales Invoice & Official Receipt"}
              </h1>
            </div>

            {/* Date & Receipt Reference Bar */}
            <div className="flex items-baseline justify-between mb-3 print:mb-2 border-b border-gray-300 pb-1 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-gray-800">Date:</span>
                <span className="font-medium text-gray-900">{formattedDate}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-bold text-gray-800">RECEIPT NO:</span>
                <span className="font-mono font-bold text-gray-900">{receiptNumber}</span>
              </div>
            </div>

            {/* Customer / Buyer Information Section */}
            <section className="mb-3 print:mb-2">
              <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">
                Buyer's Information
              </h2>
              <div className="space-y-0.5 text-xs">
                <div className="flex py-0.5 border-b border-gray-200">
                  <span className="font-bold text-gray-700 w-36 shrink-0">Full Name:</span>
                  <span className="font-semibold text-gray-900 flex-1">{customer?.name || "—"}</span>
                </div>
                <div className="flex py-0.5 border-b border-gray-200">
                  <span className="font-bold text-gray-700 w-36 shrink-0">Phone Number:</span>
                  <span className="font-medium text-gray-900 flex-1">{customer?.phone || "—"}</span>
                </div>
                <div className="flex py-0.5 border-b border-gray-200">
                  <span className="font-bold text-gray-700 w-36 shrink-0">Address:</span>
                  <span className="font-medium text-gray-900 flex-1">{customer?.address || "—"}</span>
                </div>
                {customer?.email && (
                  <div className="flex py-0.5 border-b border-gray-200">
                    <span className="font-bold text-gray-700 w-36 shrink-0">Email:</span>
                    <span className="font-medium text-gray-900 flex-1">{customer.email}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Vehicle Specification Section */}
            <section className="mb-3 print:mb-2">
              <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">
                Vehicle Specification
              </h2>

              <div className="space-y-2">
                {saleVehicleObjects.map((v: any, idx: number) => (
                  <div key={v.id || idx} className="border border-gray-200 rounded p-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Make / Brand:</span>
                        <span className="font-semibold text-gray-900">{v.make || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Model:</span>
                        <span className="font-semibold text-gray-900">{v.model || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Year:</span>
                        <span className="font-medium text-gray-900">{v.year || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Trim / Edition:</span>
                        <span className="font-medium text-gray-900">{v.trim || "Standard"}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Color:</span>
                        <span className="font-medium text-gray-900">{v.color || "—"}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-700">Engine No:</span>
                        <span className="font-mono text-gray-900">{v.engine_number || "—"}</span>
                      </div>
                      <div className="col-span-2 flex items-baseline gap-2 pt-1 border-t border-gray-200 mt-1">
                        <span className="font-bold text-gray-700">Chassis No (VIN):</span>
                        <span className="font-mono font-bold text-gray-900 tracking-wider">
                          {v.vin || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Financial Breakdown Box */}
            <section className="mb-3 print:mb-2">
              <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">
                Payment Breakdown
              </h2>

              <div className="border-2 border-gray-300 rounded-xl p-3 bg-gray-50/50">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-gray-200">
                    <span className="font-bold text-gray-700">Total Agreed Vehicle Price:</span>
                    <span className="font-extrabold text-gray-900 text-sm">₦{totalSalePrice.toLocaleString()}</span>
                  </div>

                  {isPaymentReceipt && (
                    <>
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="font-bold text-emerald-800">Amount Paid in this Transaction:</span>
                        <span className="font-black text-emerald-700 text-base">₦{paymentAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="font-bold text-gray-700">Total Paid to Date:</span>
                        <span className="font-bold text-gray-900">₦{totalPaidIncludingThis.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-gray-700">
                          {isFullPayment ? "✓ Balance Outstanding:" : "Balance Remaining:"}
                        </span>
                        <span className={`font-black ${isFullPayment ? "text-emerald-700" : "text-amber-700"}`}>
                          {isFullPayment ? "NIL — FULLY PAID" : `₦${balance.toLocaleString()}`}
                        </span>
                      </div>
                    </>
                  )}

                  {!isPaymentReceipt && (
                    <div className="flex justify-between items-center py-1">
                      <span className="font-bold text-gray-700">Payment Status:</span>
                      <span className="font-bold uppercase text-emerald-700">
                        {sale.payment_status || "Full Payment"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Amount in words */}
                <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                    Amount in Words
                  </p>
                  <p className="text-xs font-black text-gray-900 leading-snug">
                    {amountInWords} NAIRA ONLY
                  </p>
                </div>
              </div>
            </section>

            {/* Sales Terms & Disclaimer */}
            <section className="mb-3 print:mb-2 text-[10px] text-gray-600 leading-tight">
              <p className="border-l-2 border-gray-400 pl-2 italic">
                * Note: Vehicle received in inspected condition with all relevant documents delivered. Payments made are non-refundable after vehicle handover and title transfer.
              </p>
            </section>
          </div>

          {/* Footer with Signatures */}
          <PrintFooter
            customerSignature={sale.buyer_signature}
            companySignature={sale.rep_signature}
            showSignatures={true}
          />
        </div>
      </div>
    </div>
  );
}
