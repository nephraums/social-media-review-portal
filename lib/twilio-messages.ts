import twilio from "twilio";

export async function sendWhatsAppMessage(opts: { to: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.warn("[twilio] reply skipped because credentials are not configured");
    return { skipped: true };
  }

  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    from,
    to: opts.to,
    body: opts.body
  });

  return { skipped: false, sid: message.sid };
}
