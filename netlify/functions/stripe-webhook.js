const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }

  const signature = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 400, body: "Webhook is not configured." };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  if (!verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: "Invalid webhook signature." };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: "Invalid webhook payload." };
  }

  if (payload.type === "checkout.session.completed") {
    const session = payload.data?.object || {};
    const paymentReference = session.metadata?.payment_reference || session.client_reference_id;
    if (paymentReference) {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/interest_submissions?payment_reference=eq.${encodeURIComponent(paymentReference)}`,
        {
          method: "PATCH",
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            payment_status: "paid",
            payment_reference: session.payment_intent || session.id
          })
        }
      );
      if (!response.ok) {
        return { statusCode: 502, body: "Unable to update sponsorship payment status." };
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
