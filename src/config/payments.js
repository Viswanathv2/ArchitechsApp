const env = import.meta.env;

export const PAYMENT_OPTIONS = {
  zelle: {
    label: "Zelle",
    handle: env.VITE_ZELLE_HANDLE || "",
    qrUrl: env.VITE_ZELLE_QR_URL || "",
    instructions: "Open your banking app, choose Zelle, and send the selected amount to this recipient."
  },
  cashapp: {
    label: "Cash App",
    handle: env.VITE_CASHAPP_HANDLE || "",
    qrUrl: env.VITE_CASHAPP_QR_URL || "",
    instructions: "Scan the QR code or open Cash App and send the selected amount to this handle."
  },
  venmo: {
    label: "Venmo",
    handle: env.VITE_VENMO_HANDLE || "",
    qrUrl: env.VITE_VENMO_QR_URL || "",
    instructions: "Scan the QR code or open Venmo and send the selected amount to this handle."
  }
};

export const STRIPE_PAYMENT_LINK = env.VITE_STRIPE_PAYMENT_LINK || "";
export const STRIPE_FUNCTION_PATH = "/.netlify/functions/create-checkout-session";
