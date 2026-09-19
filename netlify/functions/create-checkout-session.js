exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: "Stripe is not configured on the server." });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const amount = Number(input.amount);
  const email = String(input.email || "").trim();
  const name = String(input.name || "").trim();
    const paymentReference = String(input.paymentReference || "").trim();
    if (!Number.isInteger(amount) || amount < 100 || amount > 100000000 || !email || !name || !paymentReference) {
    return json(400, { error: "A valid sponsor name, email, and amount are required." });
  }

  const origin = event.headers.origin || process.env.URL;
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Architechs FTC sponsorship donation",
    "line_items[0][price_data][product_data][description]": "Donation supporting Team 25795 Architechs",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][quantity]": "1",
      client_reference_id: paymentReference,
      "metadata[payment_reference]": paymentReference,
    "customer_creation": "always",
    "customer_email": email,
    "metadata[sponsor_name]": name,
    "metadata[sponsor_email]": email,
    success_url: `${origin}/sponsorship?payment=success`,
    cancel_url: `${origin}/sponsorship?payment=cancelled`
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    return json(502, { error: "Stripe could not create the payment session." });
  }

  return json(200, { url: data.url });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
