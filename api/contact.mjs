import { Resend } from "resend";

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return ch;
    }
  });
}

// Vercel Functions web handler format :contentReference[oaicite:1]{index=1}
export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.CONTACT_FROM_EMAIL;
    const to = process.env.CONTACT_TO_EMAIL || "ithaca.webagency@gmail.com";

    if (!apiKey || !from) {
      return jsonResponse({ ok: false, error: "Missing email configuration." }, 500);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const email = typeof data?.email === "string" ? data.email.trim() : "";
    const message = typeof data?.message === "string" ? data.message.trim() : "";

    if (!name || !email || !message) {
      return jsonResponse({ ok: false, error: "Missing required fields." }, 400);
    }

    if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
      return jsonResponse({ ok: false, error: "Input too long." }, 400);
    }

    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ ok: false, error: "Invalid email address." }, 400);
    }

    const resend = new Resend(apiKey);

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

    const subject = `New Ithaca contact form: ${name} (${email})`;
    const text = `Name: ${name}\nEmail: ${email}\n\n${message}\n`;
    const html = `
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Message:</strong><br/>${safeMessage}</p>
    `.trim();

    try {
      const { error } = await resend.emails.send({
        from,
        to: [to],
        replyTo: email,
        subject,
        text,
        html,
      });

      if (error) {
        return jsonResponse({ ok: false, error: error.message || "Email send failed." }, 502);
      }
    } catch {
      return jsonResponse({ ok: false, error: "Email send failed." }, 502);
    }

    return jsonResponse({ ok: true }, 200);
  },
};
