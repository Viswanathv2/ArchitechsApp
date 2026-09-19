// EmailJS configuration for the sponsor inquiry form.
//
// These three values come from your free EmailJS account (https://www.emailjs.com):
//   1. SERVICE_ID  -> Email Services > your service (e.g. Gmail)
//   2. TEMPLATE_ID -> Email Templates > your template
//   3. PUBLIC_KEY  -> Account > General > Public Key
//
// The EmailJS public key is safe to expose in the browser. You can either
// paste the values below, or set them in a .env file (see .env.example) as
// VITE_EMAILJS_SERVICE_ID / VITE_EMAILJS_TEMPLATE_ID / VITE_EMAILJS_PUBLIC_KEY,
// which take priority over the defaults here.

export const EMAILJS_SERVICE_ID =
  import.meta.env.VITE_EMAILJS_SERVICE_ID || "YOUR_SERVICE_ID";
export const EMAILJS_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "YOUR_TEMPLATE_ID";
export const EMAILJS_PUBLIC_KEY =
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "YOUR_PUBLIC_KEY";

// Optional dedicated template for the Join / Onboard interest form. Falls back
// to the sponsor template when not set.
export const EMAILJS_INTEREST_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_INTEREST_TEMPLATE_ID || EMAILJS_TEMPLATE_ID;

// True only when all three values have been filled in with real credentials.
export const emailjsConfigured =
  EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID" &&
  EMAILJS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID" &&
  EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY";
