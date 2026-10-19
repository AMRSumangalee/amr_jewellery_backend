
// services/smsmojoService.js

const SEND_URL = process.env.SMSMOJO_SEND_MESSAGE_URL;
const API_TOKEN = process.env.SMSMOJO_API_TOKEN;

const REQUEST_TIMEOUT_MS = 15000;

export const sendWhatsAppMessage = async (payload) => {
  if (!SEND_URL || !API_TOKEN) {
    throw new Error("SMSMOJO configuration is missing");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid SMSMOJO request payload");
  }

  if (!payload.to) {
    throw new Error("WhatsApp recipient number is missing");
  }

  if (payload.type === "template" && !payload.template_id) {
    throw new Error("SMSMOJO template ID is missing");
  }

  let response;

  try {
    response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("SMSMOJO request timed out");
    }

    console.error("SMSMOJO NETWORK ERROR:", error.message);

    throw new Error("Unable to connect to SMSMOJO");
  }

  const responseText = await response.text();

  let result;

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = {
      message: responseText,
    };
  }

  if (!response.ok || result.success === false) {
    console.error("SMSMOJO HTTP STATUS:", response.status);
    console.error("SMSMOJO ERROR RESPONSE:", result);

    const error = new Error(
      result.error ||
      result.message ||
      `SMSMOJO failed with HTTP ${response.status}`
    );

    error.status = response.status;
    error.providerResponse = result;

    throw error;
  }

  console.log("SMSMOJO MESSAGE ACCEPTED:", {
    to: payload.to,
    campaignName: result.campaign_name || payload.campaign_name,
    metaMessageId: result.meta_message_id || null,
    message: result.message || "Request accepted",
  });

  return result;
};

// Send WhatsApp image template

export const sendWhatsAppImageTemplate = async ({
  to,
  templateId,
  language = "en_US",
  orderNumber,
  imageUrl,
}) => {
  if (!to) {
    throw new Error("WhatsApp recipient number is missing");
  }

  if (!templateId) {
    throw new Error("SMSMOJO image template ID is missing");
  }

  if (!orderNumber) {
    throw new Error("Order number is missing");
  }

  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    throw new Error("A public HTTPS image URL is required");
  }

  const payload = {
    to,
    type: "template",
    template_id: templateId,
    language,
    campaign_name: "Jewellery Order Image",

    // Documentation: image_url is used for template header media.
    image_url: imageUrl,

    // Template body contains {{1}} for Order Number.
    variables: {
      "1": String(orderNumber),
    },
  };

  console.log("SMSMOJO IMAGE TEMPLATE REQUEST:", {
    to,
    template_id: templateId,
    language,
    orderNumber,
    imageUrl,
    variableCount: Object.keys(payload.variables).length,
  });

  return await sendWhatsAppMessage(payload);
};

  // ======================================================
// SEND WHATSAPP VIDEO TEMPLATE
// ======================================================


export const sendWhatsAppVideoTemplate = async ({
  to,
  templateId,
  language = "en_US",
  orderNumber,
  videoUrl,
}) => {
  if (!to) {
    throw new Error("WhatsApp recipient number is missing");
  }

  if (!templateId) {
    throw new Error("SMSMOJO video template ID is missing");
  }

  if (!orderNumber) {
    throw new Error("Order number is missing");
  }

  if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
    throw new Error("A public HTTPS video URL is required");
  }

  const payload = {
    to,
    type: "template",
    template_id: templateId,
    language,
    campaign_name: "Jewellery Order Video",

    components: [
      {
        type: "header",
        parameters: [
          {
            type: "video",
            video: {
              link: videoUrl,
            },
          },
        ],
      },
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: String(orderNumber),
          },
        ],
      },
    ],
  };

  console.log(
    "SMSMOJO VIDEO TEMPLATE COMPONENTS:",
    JSON.stringify(payload, null, 2)
  );

  return sendWhatsAppMessage(payload);
};


