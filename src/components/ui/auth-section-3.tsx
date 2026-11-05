"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAction } from "@/lib/logger";

let FlutedGlass: any = null;
try {
  FlutedGlass = require("@paper-design/shaders-react")?.FlutedGlass;
} catch (e) {
  FlutedGlass = null;
}

interface AuthSectionThreeProps {
  onSuccess?: () => void;
}

export default function AuthSectionThree({ onSuccess }: AuthSectionThreeProps) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [loading, setLoading] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await logAction("LOGIN", "Auth", null, { method: "email" });
        toast.success("Welcome back to Abuja Best Car!");
        if (onSuccess) onSuccess();
      } else {
        const fullName = `${firstName} ${lastName}`.trim() || email.split("@")[0];
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        await logAction("SIGNUP", "Auth", null, { name: fullName });
        toast.success("Account created successfully! You can now log in.");
        setMode("login");
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode === "login" ? "sign in" : "create account"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#050505] text-white antialiased">
      <div className="grid min-h-screen gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        {/* ── Left Side - Form ── */}
        <div className="flex items-center justify-center border-white/5 bg-[#0a0a0c] px-6 py-12 lg:px-14 lg:py-16 xl:px-20">
          <div className="mx-auto w-full max-w-[460px]">
            {/* Header / Logo */}
            <div className="flex items-center gap-3 mb-6">
              <img src={logo} alt="Abuja Best Car" className="h-9 w-9 rounded-xl object-contain" />
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">
                  Abuja Best Car
                </span>
                <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">
                  CRM Dealership Platform
                </p>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-white">
                {mode === "register" ? "Create an account" : "Welcome back"}
              </h1>
              <p className="text-sm text-white/50 mt-2">
                {mode === "register"
                  ? "Register to manage your fleet, sales, and dealership operations."
                  : "Sign in to access your dealership dashboard."}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="mt-6 flex p-1 bg-white/5 rounded-xl gap-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === "register"
                    ? "bg-white text-black shadow-md"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === "login"
                    ? "bg-white text-black shadow-md"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              {mode === "register" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="First name"
                      value={firstName}
                      onChange={setFirstName}
                      placeholder="First name"
                      type="text"
                    />
                    <InputField
                      label="Last name"
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Last name"
                      type="text"
                    />
                  </div>

                  <InputField
                    label="Phone Number"
                    value={phone}
                    onChange={setPhone}
                    placeholder="+234 800 000 0000"
                    type="tel"
                  />
                </>
              )}

              <InputField
                label="Email address"
                value={email}
                onChange={setEmail}
                placeholder="admin@abujabestcar.com"
                type="email"
              />

              <InputField
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Enter password"
                type="password"
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />

              {mode === "register" && (
                <div className="space-y-3 pt-2 text-xs leading-5 text-white/40">
                  <CheckboxLine checked={agreeTerms} onChange={setAgreeTerms}>
                    By creating an account, you agree to our{" "}
                    <a href="#" className="font-medium text-white/70 underline underline-offset-2">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="font-medium text-white/70 underline underline-offset-2">
                      Privacy Policy
                    </a>
                  </CheckboxLine>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex h-11 w-full items-center justify-center rounded-xl border border-white/30 bg-white text-sm font-bold text-black transition-all hover:bg-white/90 disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                ) : mode === "register" ? (
                  "Submit & Create Account"
                ) : (
                  "Sign In to Dashboard"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right Side - Marketing & Fluted Shader Visual ── */}
        <div className="relative flex min-h-[500px] flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-950 via-black to-[#050505] p-8 text-white sm:p-12 lg:min-h-0 lg:p-16 border-l border-white/5">
          {/* Background Shader Component */}
          {FlutedGlass && (
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
              <FlutedGlass
                size={0.89}
                shape="lines"
                angle={0}
                distortionShape="prism"
                distortion={0.5}
                shift={0}
                blur={0}
                edges={0.25}
                stretch={0}
                scale={1.11}
                fit="cover"
                highlights={0.1}
                shadows={0.2}
                grainMixer={0.1}
                grainOverlay={0.1}
                colorBack="#00000000"
                colorHighlight="#FFFFFF"
                colorShadow="#000000"
                className="w-full h-full bg-transparent"
              />
            </div>
          )}

          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 h-full w-full flex flex-col justify-between">
            <div className="max-w-[460px] lg:pt-12">
              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-4"
              >
                <img
                  src={logo}
                  alt="Abuja Best Cars"
                  className="size-12 shrink-0 rounded-full border border-white/20 object-cover bg-black"
                />
                <div>
                  <div className="font-semibold leading-tight text-white">
                    Abuja Best Cars
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    Dealership Management System
                  </div>
                </div>
              </motion.div>

              <motion.blockquote
                initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{
                  duration: 0.8,
                  delay: 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-7 text-2xl font-light leading-tight tracking-[-0.035em] text-white/90 sm:text-3xl lg:text-[34px]"
              >
                “Manage fleet inventory, sales records, customer proforma invoices & repairs with extreme precision.”
              </motion.blockquote>
            </div>

            {/* Dashboard Mockup Preview */}
            <div className="mt-10 w-full overflow-hidden rounded-2xl border border-white/15 bg-black/70 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{
                  duration: 0.9,
                  delay: 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 select-none">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-red-500/80" />
                    <div className="size-2.5 rounded-full bg-amber-500/80" />
                    <div className="size-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[10px] font-mono tracking-wider text-white/40 uppercase font-bold">
                    Abuja Best Car Dealership Portal
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] uppercase font-bold text-white/40">Active Fleet</p>
                    <p className="text-base font-black text-white mt-1">24 Cars</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] uppercase font-bold text-white/40">Sales</p>
                    <p className="text-base font-black text-emerald-400 mt-1">₦48.5M</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] uppercase font-bold text-white/40">Quotes</p>
                    <p className="text-base font-black text-amber-400 mt-1">12 Pending</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InputField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  showPassword,
  onTogglePassword,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}) {
  return (
    <div className="space-y-1.5 text-left w-full">
      <label className="text-xs font-semibold text-white/60">
        {label}
      </label>
      <div className="relative flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3.5 focus-within:border-white/30 transition-all">
        <input
          type={type === "password" ? (showPassword ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/20"
        />
        {type === "password" && onTogglePassword && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3.5 text-white/40 hover:text-white cursor-pointer transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function CheckboxLine({
  children,
  checked,
  onChange,
}: {
  children: ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="relative mt-0.5 size-4 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange && onChange(e.target.checked)}
          className="peer size-full cursor-pointer appearance-none rounded-[4px] border border-white/30 bg-white/5 checked:border-white checked:bg-white"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 hidden size-full p-0.5 text-black peer-checked:block"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 6.2 5 8.1 9 3.9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}
