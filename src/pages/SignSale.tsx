import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, DollarSign, Car, User, Calendar, ShieldCheck, AlertCircle, Download, FileText } from "lucide-react";
import { logAction } from "@/lib/logger";

export default function SignSale() {
  const { id } = useParams<{ id: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale-sign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          customer:customers(name, phone),
          sale_vehicles(
            price,
            vehicle:vehicles(make, model, year, vin, color)
          )
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const handleSubmit = async () => {
    if (!signature || !id) return;
    setSaving(true);
    
    const { error } = await supabase
      .from("sales")
      .update({ 
        buyer_signature: signature,
        buyer_signature_date: new Date().toISOString().split("T")[0]
      })
      .eq("id", id);
      
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
      toast.success("Signature recorded successfully!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-foreground/5 rounded-full mb-4" />
          <div className="h-4 w-32 bg-foreground/5 rounded" />
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="glass-panel p-8 text-center rounded-3xl border-white/10 max-w-md">
           <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
           <h2 className="text-xl font-bold">Invalid Signing Link</h2>
           <p className="text-muted-foreground mt-2">This sale record could not be found or the link has expired.</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md text-center rounded-3xl overflow-hidden glass-panel border-white/10 shadow-2xl">
          <CardContent className="py-12">
            <div className="bg-emerald-500/10 p-5 rounded-full inline-block mb-6">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Sale Documents Signed!</h2>
            <p className="text-muted-foreground mt-3 px-6">Thank you. Your digital signature has been recorded. You can now close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden py-12">
      {/* Decorative background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        <div className="text-center mb-8">
           <div className="bg-violet-500/10 p-4 rounded-2xl inline-block mb-4">
             <DollarSign className="h-8 w-8 text-violet-500" />
           </div>
           <h1 className="text-3xl font-heading font-extrabold tracking-tight">Purchase Agreement</h1>
           <p className="text-muted-foreground mt-2">Please review your purchase details before signing.</p>
        </div>

        <Card className="glass-panel border-white/10 rounded-3xl shadow-xl overflow-hidden">
          <CardHeader className="bg-foreground/5 border-b border-white/5 p-6">
             <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-500" />
                Agreement Summary
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="p-6 space-y-6">
                {/* Sale Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Customer Name</p>
                      <p className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-violet-500/50" /> {(sale.customer as any)?.name}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Sale Date</p>
                      <p className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-500/50" /> {new Date(sale.sale_date).toLocaleDateString()}</p>
                   </div>
                </div>

                {/* Vehicles List */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Purchased Vehicle(s)</p>
                   <div className="space-y-3">
                      {sale.sale_vehicles && (sale.sale_vehicles as any[]).length > 0 ? (
                        (sale.sale_vehicles as any[]).map((sv, idx) => (
                          <div key={idx} className="bg-foreground/5 rounded-2xl p-4 flex items-center gap-4 border border-white/5">
                            <div className="w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center text-violet-500 shadow-inner">
                                <Car className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="bg-violet-500/10 text-violet-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{sv.vehicle?.year}</span>
                                  <p className="font-bold text-lg leading-none">{sv.vehicle?.make} {sv.vehicle?.model}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: sv.vehicle?.color?.toLowerCase() || 'gray' }} />
                                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{sv.vehicle?.color} • {sv.vehicle?.vin || "No VIN"}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Price</p>
                                <p className="font-extrabold text-violet-500">₦{Number(sv.price || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      ) : sale.vehicle_id ? (
                        /* Fallback for old single-vehicle sales */
                        <div className="bg-foreground/5 rounded-2xl p-4 flex items-center gap-4 border border-white/5">
                           <div className="w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center text-violet-500 shadow-inner">
                              <Car className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                              <p className="font-bold text-lg leading-none">Vehicle Details</p>
                              <p className="text-xs text-muted-foreground">Detailed specifications available in office.</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Total Price</p>
                              <p className="font-extrabold text-violet-500">₦{Number(sale.sale_price).toLocaleString()}</p>
                           </div>
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">No vehicle details found for this record.</p>
                      )}
                   </div>
                </div>

                {(sale as any).receipt_url && (
                  <div className="mx-6 mb-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">Available Document</p>
                    <Button variant="outline" asChild className="w-full justify-between h-12 rounded-xl group border-violet-500/20 bg-background/50 hover:bg-violet-500/10 transition-all">
                      <a href={(sale as any).receipt_url} target="_blank" rel="noopener noreferrer">
                        <span className="flex items-center gap-2 font-bold text-violet-500"><FileText className="h-4 w-4" /> Official Sales Receipt</span>
                        <Download className="h-4 w-4 text-violet-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </Button>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Payment Methods</p>
                      <p className="text-sm font-medium mt-1 uppercase opacity-80">{sale.payment_type?.replace('_', ' ')} • <span className="text-emerald-500">{sale.payment_status?.replace('_', ' ')}</span></p>
                   </div>
                   <div className="text-center md:text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Amount</p>
                      <p className="text-3xl font-extrabold text-foreground tracking-tight">₦{Number(sale.sale_price).toLocaleString()}</p>
                   </div>
                </div>
             </div>

             {/* IMPORTANT DISCLAIMER */}
             <div className="bg-amber-500/10 border-y border-amber-500/10 p-6 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                   <h4 className="font-bold text-amber-500 uppercase tracking-wider text-xs">Security Note & Refund Policy</h4>
                   <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                      By providing your digital signature below, you confirm the details above are correct and acknowledge our policy: <strong className="text-foreground underline underline-offset-4 decoration-amber-500/50">NOTICE: NO REFUND AFTER PAYMENT</strong>.
                   </p>
                </div>
             </div>

             {/* Signature Pad */}
             <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-background/50 group hover:border-violet-500/30 transition-colors">
                    <SignaturePad value={signature} onChange={setSignature} />
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold opacity-50">Buyer Digital Signature</p>
                </div>

                <Button 
                  onClick={handleSubmit} 
                  disabled={!signature || saving} 
                  className="w-full h-14 rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-bold shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all text-lg"
                >
                  {saving ? "Submitting..." : "Sign & Finalize Purchase"}
                </Button>

                <div className="pt-4 text-center">
                  <p className="text-[11px] text-muted-foreground opacity-60">
                    This is a legally binding digital signature. Sales representative: <strong>{sale.rep_name || "Abuja Best Cars"}</strong>
                  </p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
