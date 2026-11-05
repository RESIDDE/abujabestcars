import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Car, Wrench, FileText, Loader2, Phone, Download, LayoutDashboard, Quote } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function CustomerPortal() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    try {
      const { data: res, error } = await (supabase as any).rpc("get_customer_portal_data", { lookup_phone: phone });
      if (error) throw error;
      if (!res) {
        toast.error("No records found for this phone number.");
        setData(null);
      } else {
        setData(res);
        toast.success("Records found!");
      }
    } catch (error: any) {
      toast.error("Failed to lookup records.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

      {/* Header */}
      <header className="p-6 border-b border-white/5 bg-background/50 backdrop-blur-xl z-10 flex items-center gap-4">
        <img src={logo} alt="Abuja Best Cars" className="h-10 w-10 rounded-full object-cover border border-white/10" />
        <h1 className="text-xl font-heading font-bold tracking-tight uppercase tracking-widest">Abuja Best Cars <span className="opacity-50">Portal</span></h1>
      </header>

      <main className="flex-1 p-6 md:p-10 z-10 max-w-4xl w-full mx-auto animate-fade-up">
        {/* Search Box */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl mb-8">
          <h2 className="text-2xl font-bold mb-2">Track your Repairs & Invoices</h2>
          <p className="text-muted-foreground mb-6">Enter your registered phone number to lookup your transaction history securely.</p>
          
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input required type="tel" placeholder="e.g. 08012345678" className="pl-12 h-14 rounded-2xl bg-background/50 border-white/10 focus-visible:ring-amber-500 text-lg" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button disabled={loading} type="submit" size="lg" className="h-14 px-8 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/25 transition-all w-full sm:w-auto">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" /> Lookup</>}
            </Button>
          </form>
        </div>

        {/* Results */}
        {data && (
          <div className="space-y-8 animate-fade-up">
            <div className="flex items-center gap-3">
               <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xl">{data.customer.name.charAt(0)}</div>
               <div>
                  <h3 className="text-2xl font-bold">{data.customer.name}</h3>
                  <p className="text-muted-foreground">{data.customer.phone}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Repairs List */}
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-lg"><Wrench className="h-5 w-5 text-amber-500" /> Active Repairs</h4>
                {data.repairs.length === 0 ? <p className="text-muted-foreground italic text-sm">No repairs found.</p> : data.repairs.map((r: any) => (
                  <div key={r.id} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-foreground">
                        {r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : `${r.manual_make || 'Unknown'} ${r.manual_model || 'Vehicle'}`}
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 font-bold uppercase">{r.payment_status}</span>
                    </div>
                    {r.condition && <div className="text-sm text-muted-foreground">Condition: {r.condition}</div>}
                    {r.unit && <div className="text-sm text-foreground bg-white/5 inline-block px-2 py-1 rounded-md mt-1">{r.unit}</div>}
                    
                    {(r.bill_url || r.job_card_url) && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {r.bill_url && (
                          <Button variant="outline" size="sm" asChild className="rounded-xl h-8 bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white transition-all group">
                            <a href={r.bill_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1.5 opacity-60 group-hover:opacity-100" /> Bill
                            </a>
                          </Button>
                        )}
                        {r.job_card_url && (
                          <Button variant="outline" size="sm" asChild className="rounded-xl h-8 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all group">
                            <a href={r.job_card_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1.5 opacity-60 group-hover:opacity-100" /> Job Card
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Invoices List */}
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-blue-500" /> Invoices</h4>
                {data.invoices.length === 0 ? <p className="text-muted-foreground italic text-sm">No invoices found.</p> : data.invoices.map((i: any) => (
                  <div key={i.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div>
                      <div className="font-bold">{i.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">₦{i.total_amount?.toLocaleString() || 0}</div>
                      <div className={`text-[10px] px-2 py-1 rounded-md uppercase font-bold inline-block mt-1 ${i.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{i.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proforma Quotes */}
            {data.quotes && data.quotes.length > 0 && (
              <div className="space-y-4 pt-4">
                <h4 className="font-bold flex items-center gap-2 text-lg"><Quote className="h-5 w-5 text-violet-500" /> Proforma Invoices</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.quotes.map((q: any) => (
                    <div key={q.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-violet-500 tracking-wider">PQ-{q.id.slice(0,8).toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">{new Date(q.quote_date).toLocaleDateString()}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="font-bold">₦{Number(q.total_amount).toLocaleString()}</div>
                        {q.quote_url && (
                          <Button variant="outline" size="sm" asChild className="rounded-xl h-8 bg-violet-500/10 border-violet-500/20 text-violet-500 hover:bg-violet-500 hover:text-white transition-all group">
                            <a href={q.quote_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1.5 opacity-60 group-hover:opacity-100" /> Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
