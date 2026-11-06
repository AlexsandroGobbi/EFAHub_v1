const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OutboxMessage = {
  id: number;
  event_type: "created" | "rescheduled" | "cancelled";
  recipient_phone: string;
  template_parameters: Record<string, string>;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("WHATSAPP_WORKER_SECRET");
  if (!expectedSecret || request.headers.get("x-worker-secret") !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION");
  const templates: Record<OutboxMessage["event_type"], string | undefined> = {
    created: Deno.env.get("WHATSAPP_TEMPLATE_BOOKING_CONFIRMED"),
    rescheduled: Deno.env.get("WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED"),
    cancelled: Deno.env.get("WHATSAPP_TEMPLATE_BOOKING_CANCELLED"),
  };

  if (!supabaseUrl || !serviceRoleKey || !accessToken || !phoneNumberId || !apiVersion) {
    return Response.json({ error: "WhatsApp worker is not configured" }, { status: 503, headers: corsHeaders });
  }
  if (Object.values(templates).some((template) => !template)) {
    return Response.json({ error: "Approved WhatsApp templates are not configured" }, { status: 503, headers: corsHeaders });
  }

  const restHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const claimResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_whatsapp_outbox`, {
    method: "POST",
    headers: restHeaders,
    body: JSON.stringify({ p_limit: 20 }),
  });
  if (!claimResponse.ok) {
    console.error("Could not claim WhatsApp messages", claimResponse.status, await claimResponse.text());
    return Response.json({ error: "Could not claim messages" }, { status: 502, headers: corsHeaders });
  }

  const messages = await claimResponse.json() as OutboxMessage[];
  const results: Array<{ id: number; status: string }> = [];
  for (const message of messages) {
    const values = message.template_parameters;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.recipient_phone,
      type: "template",
      template: {
        name: templates[message.event_type],
        language: { code: "pt_BR" },
        components: [{
          type: "body",
          parameters: [
            values.customer_name,
            values.service_name,
            values.staff_name,
            values.date,
            values.time,
            values.business_name,
          ].map((text) => ({ type: "text", text: text || "" })),
        }],
      },
    };

    let sent = false;
    let error = "WhatsApp delivery failed";
    try {
      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      sent = response.ok;
      if (!sent) error = `Meta API ${response.status}: ${(await response.text()).slice(0, 400)}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Network error";
    }

    const finishResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/finish_whatsapp_outbox`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({ p_id: message.id, p_sent: sent, p_error: sent ? null : error }),
    });
    if (!finishResponse.ok) {
      console.error("Could not persist WhatsApp delivery result", message.id, finishResponse.status, await finishResponse.text());
    }
    results.push({ id: message.id, status: sent ? "sent" : "failed" });
  }

  return Response.json({ processed: results.length, results }, { headers: corsHeaders });
});
