import { useState, useEffect } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X, Upload, FileSignature, ArrowLeft } from "lucide-react";
import VehicleMakeModelSelector from "@/components/VehicleMakeModelSelector";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { CurrencyInput } from "@/components/CurrencyInput";
import { toast } from "sonner";
import { SignaturePad } from "@/components/SignaturePad";
import { BackButton } from "@/components/BackButton";

interface FormData {
  make: string;
  model: string;
  year: string;
  vin: string;
  color: string;
  price: string;
  cost_price: string;
  mileage: string;
  fuel_type: string;
  transmission: string;
  status: string;
  description: string;
  date_arrived: string;
  date_stored: string;
  num_keys: string;
  source_company: string;
  source_company_phone: string;
  source_rep_name: string;
  source_rep_phone: string;
  condition: string;
  trim: string;
  inventory_type: string;
  source_rep_signature: string;
  accepted_by_name: string;
  accepted_by_phone: string;
  accepted_date: string;
  accepted_signature: string;
}

const emptyForm: FormData = {
  make: "",
  model: "",
  year: new Date().getFullYear().toString(),
  vin: "",
  color: "",
  price: "",
  cost_price: "",
  mileage: "0",
  fuel_type: "Petrol",
  transmission: "Automatic",
  status: "Available",
  description: "",
  date_arrived: "",
  date_stored: "",
  num_keys: "0",
  source_company: "",
  source_company_phone: "",
  source_rep_name: "",
  source_rep_phone: "",
  condition: "New",
  trim: "",
  inventory_type: "Lamido",
  source_rep_signature: "",
  accepted_by_name: "",
  accepted_by_phone: "",
  accepted_date: "",
  accepted_signature: "",
};

export default function VehicleForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm, clearDraft] = useFormPersistence<FormData>("vehicle", emptyForm, isEdit, id);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; image_url: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isResalePath = location.pathname.includes("resale-vehicles");
  const defaultType = (searchParams.get("inventory_type") || (isResalePath ? "resale" : "Lamido")) as "Lamido" | "resale";
  const { role } = useAuth();
  const { permissions } = usePermissions();
  
  // Determine page key based on inventory type
  const pageKey = (form.inventory_type === "resale" || defaultType === "resale") ? "resale-vehicles" : "vehicles";
  const hasEdit = canEdit(role, pageKey, permissions);

  useEffect(() => {
    if (isEdit && !hasEdit) {
      toast.error(`You do not have permission to edit ${pageKey.replace('-', ' ')}.`);
      navigate(pageKey === "resale-vehicles" ? "/resale-vehicles" : "/vehicles");
    }
    if (!isEdit && !canCreate(role, pageKey, permissions)) {
      toast.error(`You do not have permission to add new ${pageKey.replace('-', ' ')}.`);
      navigate(pageKey === "resale-vehicles" ? "/resale-vehicles" : "/vehicles");
    }
    if (!isEdit) {
      setForm(prev => ({ 
        ...prev, 
        inventory_type: defaultType,
        condition: defaultType === 'Lamido' ? 'New' : 'Used'
      }));
    }
  }, [isEdit, hasEdit, role, permissions, navigate, defaultType]);

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: vehicleImages = [] } = useQuery({
    queryKey: ["vehicle-images", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vehicle_id", id);
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (vehicle) {
      const v = vehicle as any;
      setForm({
        make: v.make || "",
        model: v.model || "",
        year: v.year?.toString() || "",
        vin: v.vin || "",
        color: v.color || "",
        price: v.price && v.price !== 0 ? v.price.toString() : "",
        cost_price: v.cost_price && v.cost_price !== 0 ? v.cost_price.toString() : "",
        mileage: v.mileage?.toString() || "0",
        fuel_type: v.fuel_type || "Petrol",
        transmission: v.transmission || "Automatic",
        status: v.status || "Available",
        description: v.description || "",
        date_arrived: v.date_arrived || "",
        date_stored: v.date_stored || "",
        num_keys: v.num_keys?.toString() || "0",
        source_company: v.source_company || "",
        source_company_phone: v.source_company_phone || "",
        source_rep_name: v.source_rep_name || "",
        source_rep_phone: v.source_rep_phone || "",
        condition: v.condition || "Used",
        trim: v.trim || "",
        inventory_type: v.inventory_type || "Lamido",
        source_rep_signature: v.source_rep_signature || "",
        accepted_by_name: v.accepted_by_name || "",
        accepted_by_phone: v.accepted_by_phone || "",
        accepted_date: v.accepted_date || "",
        accepted_signature: v.accepted_signature || "",
      });
    }
  }, [vehicle]);

  useEffect(() => {
    if (vehicleImages.length > 0) {
      setExistingImages(vehicleImages);
    }
  }, [vehicleImages]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.make.trim()) e.make = "Make is required";
    if (!form.model.trim()) e.model = "Model is required";
    if (!form.year || isNaN(Number(form.year))) e.year = "Valid year required";
    if (form.vin && form.vin.length > 17) e.vin = "VIN must be ≤17 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const checkVinUnique = async (): Promise<boolean> => {
    if (!form.vin.trim()) return true;
    const query = supabase
      .from("vehicles")
      .select("id")
      .eq("vin", form.vin.trim());
    if (isEdit) query.neq("id", id!);
    const { data } = await query;
    if (data && data.length > 0) {
      setErrors((prev) => ({ ...prev, vin: "This VIN already exists" }));
      return false;
    }
    return true;
  };

  const uploadImages = async (vehicleId: string) => {
    for (const file of imageFiles) {
      const ext = file.name.split(".").pop();
      const path = `${vehicleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("vehicle-images")
        .upload(path, file);
      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("vehicle-images")
        .getPublicUrl(path);
      await supabase.from("vehicle_images").insert({
        vehicle_id: vehicleId,
        image_url: urlData.publicUrl,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!(await checkVinUnique())) return;
    setSubmitting(true);

    try {
      const payload: any = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: parseInt(form.year),
        vin: form.vin.trim() || null,
        color: form.color.trim() || null,
        price: parseFloat(form.price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        mileage: parseInt(form.mileage) || 0,
        fuel_type: form.fuel_type,
        transmission: form.transmission,
        status: form.status,
        description: form.description.trim() || null,
        date_arrived: form.date_arrived || null,
        date_stored: form.date_stored || null,
        num_keys: parseInt(form.num_keys) || 0,
        source_company: form.source_company.trim() || null,
        source_company_phone: form.source_company_phone?.trim() || null,
        source_rep_name: form.source_rep_name?.trim() || null,
        source_rep_phone: form.source_rep_phone?.trim() || null,
        condition: form.condition,
        trim: form.trim.trim() || null,
        inventory_type: form.inventory_type,
        source_rep_signature: form.source_rep_signature || null,
        accepted_by_name: form.accepted_by_name?.trim() || null,
        accepted_by_phone: form.accepted_by_phone?.trim() || null,
        accepted_date: form.accepted_date || null,
        accepted_signature: form.accepted_signature || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", id!);
        if (error) throw error;
        await uploadImages(id!);
        await logAction("UPDATE", "Vehicle", id, {
          make: form.make, model: form.model, year: form.year,
          vin: form.vin, inventory_type: form.inventory_type,
        });
        toast.success("Vehicle updated successfully. Please note it might take a moment to reflect across all views.");
      } else {
        const { data, error } = await supabase.from("vehicles").insert(payload).select().single();
        if (error) throw error;
        await uploadImages(data.id);
        await logAction("CREATE", "Vehicle", data.id, {
          make: form.make, model: form.model, year: form.year,
          vin: form.vin, inventory_type: form.inventory_type,
          source_company: form.source_company,
        });
        toast.success("Vehicle added successfully. Please note it might take a moment to reflect across all views.");
      }

      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      clearDraft();
      navigate(form.inventory_type === 'resale' ? "/resale-vehicles" : "/vehicles");
    } catch (err: any) {
      toast.error(err.message || "Failed to save vehicle");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalCurrentImages = imageFiles.length + existingImages.length;
    
    if (totalCurrentImages + files.length > 2) {
      toast.error("Maximum 2 images allowed per vehicle");
      return;
    }

    const validFiles: File[] = [];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds the 5MB size limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setImageFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(f);
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imgId: string) => {
    await supabase.from("vehicle_images").delete().eq("id", imgId);
    setExistingImages((prev) => prev.filter((img) => img.id !== imgId));
  };

  const field = (
    key: keyof FormData,
    label: string,
    type: string = "text",
    required = false,
    currency = false
  ) => (
    <div className="space-y-1">
      <Label htmlFor={key}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {currency ? (
        <CurrencyInput
          id={key}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <Input
          id={key}
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
      {errors[key] && (
        <p className="text-sm text-destructive">{errors[key]}</p>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/vehicles" />
        <h1 className="text-3xl font-bold text-foreground">
          {isEdit 
            ? (form.inventory_type === 'resale' ? "Edit Resale Vehicle" : "Edit Vehicle") 
            : (form.inventory_type === 'resale' ? "Add Resale Vehicle" : "Add Vehicle")
          }
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <VehicleMakeModelSelector
              make={form.make}
              model={form.model}
              year={form.year}
              onMakeChange={(v) => setForm({ ...form, make: v })}
              onModelChange={(v) => setForm({ ...form, model: v })}
              onYearChange={(v) => setForm({ ...form, year: v })}
              errors={{ make: errors.make, model: errors.model, year: errors.year }}
              required={{ make: true, model: true, year: true }}
            />
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="vin">Chassis Number (VIN)</Label>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${form.vin.length > 17 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                  {form.vin.length}/17
                </span>
              </div>
              <Input
                id="vin"
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
                placeholder="Enter 17-digit VIN"
                className={form.vin.length > 17 ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.vin && (
                <p className="text-sm text-destructive">{errors.vin}</p>
              )}
            </div>
            {field("trim", "Trim (e.g. LE, Sport)")}
            {field("color", "Color")}
            {field("mileage", "Mileage", "number")}

            <div className="space-y-1">
              <Label>Fuel Type</Label>
              <Select
                value={form.fuel_type}
                onValueChange={(v) => setForm({ ...form, fuel_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Petrol">Petrol</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Electric">Electric</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Transmission</Label>
              <Select
                value={form.transmission}
                onValueChange={(v) => setForm({ ...form, transmission: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Automatic">Automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field("price", "Selling Price", "text", false, true)}
            {field("cost_price", "Cost Price", "text", false, true)}

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Sold">Sold</SelectItem>
                  <SelectItem value="Reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Condition</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm({ ...form, condition: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Used">Used</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field("date_arrived", "Date Arrived", "date")}
            {field("date_stored", "Date Stored", "date")}
            {field("num_keys", "Number of Keys", "number")}
          </CardContent>
        </Card>

        {/* Source Person Info - Show for both, but required for resale signature */}
        <Card className={form.inventory_type === 'resale' ? "border-emerald-500/20 bg-emerald-500/5 shadow-lg" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> 
              {form.inventory_type === 'resale' ? "Person Who Brought the Vehicle" : "Source Company/Owner Info"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {form.inventory_type !== 'resale' && (
              <>
                {field("source_company", "Company/Owner the vehicle is from")}
                {field("source_company_phone", "Company/Owner Phone Number", "tel")}
              </>
            )}
            {field("source_rep_name", form.inventory_type === 'resale' ? "Full Name" : "Representative Name")}
            {field("source_rep_phone", form.inventory_type === 'resale' ? "Phone Number" : "Representative Phone", "tel")}
            
            {(form.inventory_type === 'resale' || form.source_rep_name) && (
              <div className="md:col-span-2 space-y-2 mt-2">
                <Label>{form.inventory_type === 'resale' ? "Signature of Person Who Brought Vehicle" : "Representative Digital Signature"}</Label>
                <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
                  <SignaturePad 
                    value={form.source_rep_signature} 
                    onChange={(v) => setForm({ ...form, source_rep_signature: v })} 
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {form.inventory_type !== 'resale' && (
          <Card className="border-rose-500/20 bg-rose-500/5 animate-fade-down">
            <CardHeader>
              <CardTitle className="text-rose-500 flex items-center gap-2 text-base">
                <FileSignature className="h-5 w-5" /> Recording / Acceptance Details
              </CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {field("accepted_by_name", "Accepted By (Staff Name)")}
                  {field("accepted_by_phone", "Phone Number of Person Who Brought It", "tel")}
                  {field("accepted_date", "Acceptance Date", "date")}
                </div>
                <div className="space-y-2">
                  <Label>Staff Digital Signature</Label>
                  <div className="rounded-2xl border border-white/10 bg-background/50 p-4">
                    <SignaturePad 
                      value={form.accepted_signature} 
                      onChange={(v) => setForm({ ...form, accepted_signature: v })} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              placeholder="Additional notes about the vehicle..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition-colors">
                <Upload className="h-4 w-4" />
                Choose Files
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-sm text-muted-foreground">
                {imageFiles.length + existingImages.length} / 2 image(s) (Max 5MB each)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Only image formats are allowed. Videos are not permitted.</p>

            {(existingImages.length > 0 || imagePreviews.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.image_url}
                      alt=""
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving..."
              : isEdit
              ? "Update Vehicle"
              : "Add Vehicle"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(form.inventory_type === 'resale' ? "/resale-vehicles" : "/vehicles")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
