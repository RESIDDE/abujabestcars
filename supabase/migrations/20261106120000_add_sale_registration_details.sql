-- Vehicle Sales Agreement Receipt — registered-vehicle details
--
-- A sale of a registered vehicle is documented on the booklet form, which
-- carries an engine and registration number, two witnesses and the seller's
-- details. A sale of an unregistered vehicle uses the plain receipt and has
-- none of that, so the extra data is kept in one nullable JSON column rather
-- than a dozen columns that stay empty most of the time.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_details jsonb;

COMMENT ON COLUMN public.sales.is_registered IS
  'True when the sale is documented on the registered-vehicle agreement receipt (witnesses, sold-by, engine/registration numbers).';

COMMENT ON COLUMN public.sales.agreement_details IS
  'Registered-vehicle agreement fields: engine_no, registration_no, witnesses[], sold_by{}. Null for unregistered sales.';
