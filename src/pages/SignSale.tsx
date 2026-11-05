import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, PenLine, ShieldCheck, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { SaleReceiptSheet } from "@/components/sales/SalePrintPreview";

export default function SignSale() {
  const { id } = useParams<{ id: string }>();
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const signSectionRef = useRef<HTMLDivElement>(null);

  const { data: sale, isLoading, refetch } = useQuery({
    queryKey: ["sale-sign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          customer:customers(*),
          sale_vehicles(
            price,
            vehicle:vehicles(*)
          ),
          sale_payments(*)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Collect vehicles
  const vehiclesList = sale?.sale_vehicles?.map((sv: any) => sv.vehicle).filter(Boolean) || [];

  const alreadySigned = Boolean(sale?.buyer_signature) || submitted;
  // Only this sale's own signature counts — never a signature carried over from another document.
  const activeSignature = signature || sale?.buyer_signature || null;
  const activeSignatureDate = sale?.buyer_signature_date || (alreadySigned ? new Date().toISOString() : null);

  const scrollToSign = () => {
    signSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async () => {
    if (!signature || !id) return;
    setSaving(true);
    
    const nowIsoDate = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("sales")
      .update({ 
        buyer_signature: signature,
        buyer_signature_date: nowIsoDate
      })
      .eq("id", id);
      
    if (!error && (sale as any)?.customer_id) {
      await supabase
        .from("customers")
        .update({ signature_data: signature })
        .eq("id", (sale as any).customer_id);
    }
      
    setSaving(false);
    if (error) {
      console.error("Signature save error:", error);
      toast.error(`Could not save signature: ${error.message || 'Permission denied'}`);
    } else {
      await logAction("SIGNATURE", "Sales", id, { 
        customer: (sale?.customer as any)?.name,
        type: "Sale Agreement Purchase"
      });
      setSubmitted(true);
      await refetch();
      toast.success("Signed document successfully");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-900 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-white/10 rounded-full mb-4" />
          <div className="h-4 w-40 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
        <Card className="glass-panel p-8 text-center rounded-3xl border-white/10 max-w-md bg-zinc-900">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold">Invalid Signing Link</h2>
          <p className="text-muted-foreground mt-2">This sale record could not be found or the link has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-foreground py-8 px-4 flex flex-col items-center relative overflow-x-hidden">
      {/* View-only copy: printing / "save as PDF" yields a notice instead of the document */}
      <style dangerouslySetInnerHTML={{ __html: `
        .no-save img { -webkit-user-drag: none; user-select: none; }
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .print-blocked, .print-blocked * { visibility: visible !important; }
          .print-blocked {
            position: fixed !important; inset: 0 !important;
            display: flex !important; flex-direction: column;
            align-items: center; justify-content: center; gap: 8px;
            text-align: center; padding: 40px; color: #111;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          }
        }
      `}} />
      <div className="print-blocked hidden">
        <div style={{ fontSize: 20, fontWeight: 800, color: "#d9342b" }}>ABUJA BEST CARS LTD</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>This copy cannot be printed or downloaded.</div>
        <div style={{ fontSize: 12, color: "#555", maxWidth: 420 }}>
          Your signed document is available to view online. Please contact Abuja Best Cars Ltd
          on {"+234 903 995 4141"} to be issued your official copy.
        </div>
      </div>

      {/* Background ambient accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header / Instructions Bar */}
      <header className="w-full max-w-4xl mb-6 text-center z-10 print:hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Official Abuja Best Cars LTD Customer Portal
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Vehicle Sales Receipt
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          {alreadySigned
            ? "Signed document successfully. Your signature is now on the document below."
            : "Please review the receipt below, then provide your digital signature."}
        </p>

        {/* Status banner */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {alreadySigned ? (
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-2xl text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Signed document successfully
            </div>
          ) : (
            <Button
              onClick={scrollToSign}
              className="rounded-full gap-2 bg-[#d4ff32] hover:brightness-105 text-black font-extrabold shadow-lg px-6 h-10 text-xs"
            >
              <PenLine className="w-4 h-4" /> Tap to Sign Document
            </Button>
          )}

          <div className="inline-flex items-center gap-2 bg-white/5 text-zinc-400 border border-white/10 px-4 py-2 rounded-2xl text-[11px] font-semibold">
            <Lock className="w-3.5 h-3.5" />
            View only — this copy cannot be downloaded or printed
          </div>
        </div>
      </header>

      {/* The A4 sheet — identical to the receipt issued by the office (view only) */}
      <div
        className="w-full max-w-4xl flex justify-center overflow-x-auto z-10 pb-4 no-save"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <SaleReceiptSheet
          sale={sale}
          customer={sale.customer}
          vehicles={vehiclesList}
          customerSignature={activeSignature}
          customerSignatureDate={activeSignatureDate}
          repSignature={sale.rep_signature}
          repSignatureDate={sale.rep_signature_date}
          onSignClick={scrollToSign}
          isSigningMode={!alreadySigned}
        />
      </div>

      {/* Signing Section at the bottom */}
      {!alreadySigned && (
        <div ref={signSectionRef} className="w-full max-w-2xl mt-8 z-10 print:hidden">
          <Card className="bg-zinc-950 border-2 border-[#d4ff32]/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-[#d4ff32]/20 flex items-center justify-center text-[#d4ff32]">
                <PenLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Your Digital Signature</h3>
                <p className="text-xs text-zinc-400">
                  Draw your signature in the box below using your finger, stylus, or mouse.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <SignaturePad value={signature} onChange={setSignature} />
            </div>

            {/* Terms checkbox confirmation */}
            <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-white/5 text-[11px] text-zinc-400 leading-relaxed">
              By submitting your signature, you confirm that you have inspected the vehicle, agree to the terms of sale, and acknowledge that all payments made are non-refundable after vehicle handover.
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!signature || saving}
              className="w-full mt-5 h-13 rounded-2xl bg-[#d4ff32] hover:brightness-105 text-black font-extrabold text-base shadow-xl active:scale-[0.99] transition-all disabled:opacity-40"
            >
              {saving ? "Signing document..." : "Done"}
            </Button>
          </Card>
        </div>
      )}

      {alreadySigned && (
        <div className="w-full max-w-2xl mt-8 z-10 print:hidden">
          <Card className="bg-zinc-950 border-2 border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white mt-4">Signed document successfully</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Your signature has been recorded and now appears on the document above.
              This page is view only — Abuja Best Cars Ltd will issue your official copy.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
