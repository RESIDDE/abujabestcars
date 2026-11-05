-- ==============================================================================
-- MASTER DATABASE INITIALIZATION SCRIPT FOR NEW SUPABASE PROJECT
-- Project: Abuja Best Car Inventory (Lamido Cars / Bee Tee)
-- Instructions:
-- 1. Create your new Supabase project at https://supabase.com
-- 2. Open SQL Editor in your new Supabase project dashboard
-- 3. Paste this ENTIRE file into the SQL Editor and click "RUN"
-- 4. In your local project .env file, update:
--      VITE_SUPABASE_URL="https://<YOUR_NEW_PROJECT_ID>.supabase.co"
--      VITE_SUPABASE_PUBLISHABLE_KEY="<YOUR_NEW_ANON_PUBLIC_KEY>"
--      VITE_SUPABASE_PROJECT_ID="<YOUR_NEW_PROJECT_ID>"
-- 5. Sign up your first user in the app — they will automatically become Super Admin!
-- ==============================================================================

-- ==============================================================================
-- 0. EXTENSIONS & ENUMS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'mechanic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 1. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 1.1 Updated at timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 2. CORE USERS, PROFILES & ROLES
-- ==============================================================================

-- 2.1 Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.2 User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'admin'
);

-- 2.2b User role check helper function
CREATE OR REPLACE FUNCTION public.has_role(checking_role app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = checking_role
  );
$$;

-- 2.3 Automatic Profile & Role on Signup Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Create a profile for the new user
  INSERT INTO public.profiles (user_id, display_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. First registered user automatically becomes 'admin'.
  -- Subsequent users have role assigned or default to 'admin' if none exist.
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2.4 Permanent User Deletion Function (for Super Admin Settings)
CREATE OR REPLACE FUNCTION public.delete_user_permanently(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can delete users permanently.';
  END IF;

  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_permanently(uuid) TO authenticated;

-- ==============================================================================
-- 3. VEHICLES & INVENTORY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  cost_price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'Available',
  inventory_type text NOT NULL DEFAULT 'lamido',
  vin text UNIQUE,
  trim text,
  color text,
  mileage numeric,
  fuel_type text,
  transmission text,
  num_keys integer NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'Used',
  description text,
  image_url text,
  source_company text,
  source_company_phone text,
  source_rep_name text,
  source_rep_phone text,
  source_rep_signature text,
  accepted_by_name text,
  accepted_by_phone text,
  accepted_date date,
  accepted_signature text,
  date_arrived date,
  date_stored date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. CUSTOMERS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  signature_data text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. SALES, SALE VEHICLES & SALE PAYMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text DEFAULT 'cash',
  payment_status text DEFAULT 'paid_in_full',
  notes text,
  rep_name text,
  rep_signature text,
  rep_signature_date date,
  buyer_signature text,
  buyer_signature_date date,
  receipt_url text,
  salesperson_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support for multi-vehicle transactions per sale
CREATE TABLE IF NOT EXISTS public.sale_vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  price numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Split and installment payments on sales
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date timestamptz DEFAULT now(),
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 6. INVOICES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_type text NOT NULL DEFAULT 'sale',
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. REPAIRS, JOB CARDS & REPAIR PAYMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.repairs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  manual_make text,
  manual_model text,
  manual_year text,
  model_year integer,
  unit text,
  condition text,
  company text,
  replacement_parts text,
  damaged_parts text,
  to_be_resprayed boolean NOT NULL DEFAULT false,
  respray_notes text,
  repair_cost numeric DEFAULT 0,
  deposit_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'deposit',
  payment_type text DEFAULT 'cash',
  bank_account text DEFAULT 'servicing',
  brought_in_by text,
  handed_to text,
  notes text,
  signature_data text,
  rep_name text,
  rep_signature text,
  rep_signature_date date,
  bill_url text,
  job_card_url text,
  job_card_no text,
  expected_delivery_date date,
  service_supervisor text,
  technician_assigned text,
  registration_no text,
  vin_chassis text,
  mileage text,
  fuel_level text,
  condition_check jsonb DEFAULT '[]'::jsonb,
  inspection_notes text,
  customer_complaint text,
  painting_bodywork jsonb DEFAULT '{"items": [], "details": ""}'::jsonb,
  mechanical_service jsonb DEFAULT '{"items": [], "details": ""}'::jsonb,
  replacement_parts_list jsonb DEFAULT '[]'::jsonb,
  parts_to_replace text,
  parts_total numeric DEFAULT 0,
  labour_total numeric DEFAULT 0,
  other_charges numeric DEFAULT 0,
  vat numeric DEFAULT 0,
  date_out date,
  checked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.repair_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_id uuid REFERENCES public.repairs(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date timestamptz DEFAULT now(),
  payment_method text DEFAULT 'cash',
  notes text,
  bank_account text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_repairs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. VEHICLE INSPECTIONS (GATEPASS & PICKUPS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inspections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  inspector_name text NOT NULL,
  condition_at_pickup text NOT NULL,
  pickup_date timestamptz NOT NULL DEFAULT now(),
  signature_data text,
  returned_in_good_condition boolean NOT NULL DEFAULT false,
  return_condition_notes text,
  return_date timestamptz,
  sent_by text,
  picker_name text,
  picker_phone text,
  picker_date timestamptz DEFAULT now(),
  picker_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 9. INQUIRIES & LEAD MANAGEMENT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  manual_customer_name text,
  manual_customer_phone text,
  manual_customer_email text,
  manual_vehicle_make text,
  manual_vehicle_model text,
  manual_vehicle_year text,
  taken_by text,
  advanced_questionnaire jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. PERFORMANCE QUOTES (PROFORMA INVOICES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.performance_quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  quote_url text,
  vat_percentage numeric DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  bank_name text,
  account_number text,
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_quote_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.performance_quotes(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_description text,
  base_price numeric NOT NULL DEFAULT 0,
  has_duty boolean NOT NULL DEFAULT false,
  duty_price numeric DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  condition text,
  transmission text,
  cylinders text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 11. AUTHORITY TO SELL (ATS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.authority_to_sell (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_date date DEFAULT CURRENT_DATE,
  customer_name text NOT NULL,
  customer_address text,
  customer_phone text,
  customer_id_type text,
  vehicle_make text NOT NULL,
  vehicle_year_model text,
  vehicle_color text,
  vehicle_engine_number text,
  vehicle_chassis text,
  valid_until date,
  note text,
  signature text,
  rep_name text,
  rep_signature text,
  rep_signature_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 12. SALES AGREEMENTS (CHANGE OF OWNERSHIP)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.sales_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_date date DEFAULT CURRENT_DATE,
  seller_name text NOT NULL,
  seller_address text,
  seller_phone text,
  seller_id_type text,
  buyer_name text NOT NULL,
  buyer_address text,
  buyer_phone text,
  buyer_id_type text,
  vehicle_make text NOT NULL,
  vehicle_year_model text,
  vehicle_color text,
  vehicle_engine_number text,
  vehicle_chassis text,
  vehicle_plate_number text,
  sale_price text,
  payment_method text,
  note text,
  seller_signature text,
  buyer_signature text,
  seller_witness_name text,
  seller_witness_signature text,
  buyer_witness_name text,
  buyer_witness_signature text,
  rep_name text,
  rep_signature text,
  rep_signature_date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 13. COMPANY EXPENSES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Errands & Logistics',
  errand_by text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'Cash',
  notes text,
  receipt_url text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  batch_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 14. CLOUD DOCUMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Document',
  content text NOT NULL DEFAULT '',
  letterhead boolean NOT NULL DEFAULT false,
  watermark boolean NOT NULL DEFAULT false,
  watermark_opacity numeric(4,3) NOT NULL DEFAULT 0.08,
  margins text NOT NULL DEFAULT 'normal',
  orientation text NOT NULL DEFAULT 'portrait',
  font_family text NOT NULL DEFAULT '''Outfit'', sans-serif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 15. APP SETTINGS & PERMISSIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES 
  ('permissions', '{"admin": {"view": ["dashboard","vehicles","customers","sales","invoices","inquiries","authority-to-sell","performance-quotes","repairs","inspections","expenses"], "create": ["dashboard","vehicles","customers","sales","invoices","inquiries","authority-to-sell","performance-quotes","repairs","inspections","expenses"], "edit": ["dashboard","vehicles","customers","sales","invoices","inquiries","authority-to-sell","performance-quotes","repairs","inspections","expenses"]}, "sales": {"view": ["dashboard","vehicles","customers","sales","invoices","inquiries","performance-quotes","authority-to-sell"], "create": ["vehicles","customers","sales","invoices","inquiries","performance-quotes","authority-to-sell"], "edit": ["vehicles","customers","sales","invoices","inquiries","performance-quotes","authority-to-sell"]}, "mechanic": {"view": ["dashboard","vehicles","repairs","inspections"], "create": ["vehicles","repairs","inspections"], "edit": ["vehicles","repairs","inspections"]}}'::jsonb),
  ('service_interval_months', '"3"'::jsonb),
  ('service_interval_days', '"0"'::jsonb)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- ==============================================================================
-- 16. AUDIT LOGS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 17. CUSTOMER PORTAL RPC FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_portal_data(lookup_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    found_customer RECORD;
    customer_repairs JSON;
    customer_invoices JSON;
    customer_quotes JSON;
BEGIN
    SELECT * INTO found_customer FROM public.customers WHERE phone = lookup_phone LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT json_agg(r) INTO customer_repairs
    FROM (
        SELECT 
            repairs.*,
            json_build_object(
                'make', vehicles.make,
                'model', vehicles.model,
                'year', vehicles.year
            ) as vehicle
        FROM public.repairs
        LEFT JOIN public.vehicles ON repairs.vehicle_id = vehicles.id
        WHERE repairs.customer_id = found_customer.id
        ORDER BY repairs.created_at DESC
    ) r;

    SELECT json_agg(i) INTO customer_invoices
    FROM (
        SELECT * FROM public.invoices 
        WHERE customer_id = found_customer.id 
        ORDER BY created_at DESC
    ) i;
    
    SELECT json_agg(q) INTO customer_quotes
    FROM (
        SELECT * FROM public.performance_quotes 
        WHERE customer_id = found_customer.id 
        ORDER BY created_at DESC
    ) q;

    RETURN json_build_object(
        'customer', found_customer,
        'repairs', COALESCE(customer_repairs, '[]'::json),
        'invoices', COALESCE(customer_invoices, '[]'::json),
        'quotes', COALESCE(customer_quotes, '[]'::json)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_customer_portal_data(text) TO anon, authenticated;

-- ==============================================================================
-- 18. UPDATED_AT TRIGGERS FOR ALL TABLES
-- ==============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT unnest(ARRAY[
      'profiles', 'vehicles', 'customers', 'sales', 'invoices', 
      'repairs', 'inspections', 'inquiries', 'performance_quotes', 
      'expenses', 'documents', 'app_settings'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ==============================================================================
-- 19. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 19.1 Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role('admin'));

-- 19.2 User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_all" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 19.3 Vehicles & Images (public read for portal/inventory, all for staff)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicles_all" ON public.vehicles;
CREATE POLICY "vehicles_all" ON public.vehicles FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_images_all" ON public.vehicle_images;
CREATE POLICY "vehicle_images_all" ON public.vehicle_images FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.4 Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_all" ON public.customers;
CREATE POLICY "customers_all" ON public.customers FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.5 Sales, Sale Vehicles & Payments
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_all" ON public.sales;
CREATE POLICY "sales_all" ON public.sales FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.sale_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_vehicles_all" ON public.sale_vehicles;
CREATE POLICY "sale_vehicles_all" ON public.sale_vehicles FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_payments_all" ON public.sale_payments;
CREATE POLICY "sale_payments_all" ON public.sale_payments FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.6 Invoices & Invoice Repairs
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_repairs_all" ON public.invoice_repairs;
CREATE POLICY "invoice_repairs_all" ON public.invoice_repairs FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.7 Repairs & Repair Payments
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "repairs_all" ON public.repairs;
CREATE POLICY "repairs_all" ON public.repairs FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.repair_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "repair_payments_all" ON public.repair_payments;
CREATE POLICY "repair_payments_all" ON public.repair_payments FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.8 Inspections
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inspections_all" ON public.inspections;
CREATE POLICY "inspections_all" ON public.inspections FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.9 Inquiries
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inquiries_all" ON public.inquiries;
CREATE POLICY "inquiries_all" ON public.inquiries FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.10 Performance Quotes & Items
ALTER TABLE public.performance_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "performance_quotes_all" ON public.performance_quotes;
CREATE POLICY "performance_quotes_all" ON public.performance_quotes FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.performance_quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "performance_quote_items_all" ON public.performance_quote_items;
CREATE POLICY "performance_quote_items_all" ON public.performance_quote_items FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.11 Authority to Sell
ALTER TABLE public.authority_to_sell ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ats_all" ON public.authority_to_sell;
CREATE POLICY "ats_all" ON public.authority_to_sell FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.12 Sales Agreements
ALTER TABLE public.sales_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_agreements_all" ON public.sales_agreements;
CREATE POLICY "sales_agreements_all" ON public.sales_agreements FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.13 Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL TO public USING (true) WITH CHECK (true);

-- 19.14 Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_user_access" ON public.documents;
CREATE POLICY "documents_user_access" ON public.documents FOR ALL TO authenticated 
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 19.15 App Settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_all" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "app_settings_all" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 19.16 Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ==============================================================================
-- 20. STORAGE BUCKETS & POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('vehicle-images', 'vehicle-images', true),
  ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Storage vehicle images and documents access" ON storage.objects;
CREATE POLICY "Storage vehicle images and documents access" 
ON storage.objects 
FOR ALL TO public 
USING (bucket_id IN ('vehicle-images', 'documents')) 
WITH CHECK (bucket_id IN ('vehicle-images', 'documents'));

-- ==============================================================================
-- 21. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'app_settings', 'sales', 'sale_payments', 'vehicles', 
      'performance_quotes', 'sales_agreements', 'expenses', 'repairs', 'audit_logs'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN others THEN null;
      END;
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 22. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_inventory_type ON public.vehicles(inventory_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON public.vehicles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_vehicle_id ON public.sales(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_vehicles_sale_id ON public.sale_vehicles(sale_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale_id ON public.invoices(sale_id);

CREATE INDEX IF NOT EXISTS idx_repairs_vehicle_id ON public.repairs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_repairs_customer_id ON public.repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_created_at ON public.repairs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspections_vehicle_id ON public.inspections(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_performance_quotes_customer ON public.performance_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_performance_quotes_created ON public.performance_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.performance_quote_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_authority_to_sell_chassis ON public.authority_to_sell(vehicle_chassis);
CREATE INDEX IF NOT EXISTS idx_authority_to_sell_created ON public.authority_to_sell(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_agreements_chassis ON public.sales_agreements(vehicle_chassis);
CREATE INDEX IF NOT EXISTS idx_sales_agreements_date ON public.sales_agreements(agreement_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_agreements_created ON public.sales_agreements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON public.expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- DONE! Your database is completely configured and ready.
-- ==============================================================================
