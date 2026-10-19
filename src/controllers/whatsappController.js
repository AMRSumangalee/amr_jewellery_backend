
import { sendWhatsAppMessage } from "../services/whatsappService.js";

export const sendTestWhatsAppController = async (req, res) => {
  try {
    const {
      to,
      type = "template",
      text,
      template_id,
      language = "en",
      variables,
      campaign_name = "Jewellery Order Management",
    } = req.body;

    // ==========================================
    // 1. DEBUG REQUEST
    // ==========================================
    console.log("========== WHATSAPP REQUEST ==========");
    console.log("To:", to);
    console.log("Type:", type);
    console.log("Template ID:", template_id);
    console.log("Language:", language);
    console.log("Variables:", variables || {});
    console.log("Has Text:", Boolean(text));
    console.log("=======================================");

    // ==========================================
    // 2. VALIDATE PHONE NUMBER
    // ==========================================
    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Recipient phone number is required",
      });
    }

    // Accept +91XXXXXXXXXX or 91XXXXXXXXXX
    const phone = String(to).replace(/[\s+\-()]/g, "");

    if (!/^\d{8,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid phone number. Include country code, for example 919876543210",
      });
    }

    // ==========================================
    // 3. BUILD SMSMOJO PAYLOAD
    // ==========================================
    const payload = {
      to: phone,
      type,
      campaign_name,
    };

    // ==========================================
    // 4. TEMPLATE MESSAGE
    // ==========================================
    if (type === "template") {
      if (!template_id) {
        return res.status(400).json({
          success: false,
          message: "template_id is required for template messages",
        });
      }

      payload.template_id = String(template_id);
      payload.language = language;

      // Include variables only when provided
      if (
        variables &&
        typeof variables === "object" &&
        !Array.isArray(variables) &&
        Object.keys(variables).length > 0
      ) {
        payload.variables = variables;
      }
    }

    // ==========================================
    // 5. TEXT MESSAGE
    // ==========================================
    else if (type === "text") {
      if (!text || !String(text).trim()) {
        return res.status(400).json({
          success: false,
          message: "text is required for text messages",
        });
      }

      payload.text = String(text).trim();
    }

    // ==========================================
    // 6. UNSUPPORTED MESSAGE TYPE
    // ==========================================
    else {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported message type. Supported types: template, text",
      });
    }

    // ==========================================
    // 7. SEND TO SMSMOJO
    // ==========================================
    console.log("SMSMOJO PAYLOAD:", JSON.stringify(payload, null, 2));

    const result = await sendWhatsAppMessage(payload);

    console.log("SMSMOJO SUCCESS:", JSON.stringify(result, null, 2));

    return res.status(200).json({
      success: true,
      message: "WhatsApp request submitted successfully",
      data: result,
    });
  } catch (error) {
    // ==========================================
    // 8. ERROR HANDLING
    // ==========================================
    console.error("========== WHATSAPP ERROR ==========");
    console.error("Message:", error.message);
    console.error("Status:", error.status || 500);
    console.error(
      "Provider Response:",
      JSON.stringify(error.providerResponse || null, null, 2)
    );
    console.error("====================================");

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to send WhatsApp message",
      providerResponse: error.providerResponse || null,
    });
  }
};
