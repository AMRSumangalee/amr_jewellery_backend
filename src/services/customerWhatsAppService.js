
import { sendWhatsAppMessage } from "./smsmojoService.js";

// Normalize an Indian customer mobile number.
const getCustomerPhone = (phone) => {
  if (!phone) {
    throw new Error("Customer phone number is missing");
  }

  let number = String(phone).replace(/\D/g, "");

  // Convert a 10-digit Indian number to country-code format.
  if (number.length === 10) {
    number = `91${number}`;
  }

  if (!/^91\d{10}$/.test(number)) {
    throw new Error("Invalid Indian customer phone number");
  }

  return number;
};

// Send customer notification after FINAL_CONFIRMED.
export const sendFinalConfirmedToCustomer = async (order) => {
  if (order.status !== "FINAL_CONFIRMED") {
    return {
      skipped: true,
      reason: "Order is not FINAL_CONFIRMED",
    };
  }

  const templateId =
    process.env.SMSMOJO_CUSTOMER_FINAL_CONFIRMED_TEMPLATE_ID;

  if (!templateId) {
    throw new Error(
      "Customer FINAL_CONFIRMED template ID is missing",
    );
  }

  const to = getCustomerPhone(order.customerPhone);

  // Match these variable positions with the approved template.

const variables = {
  "1": order.customerName || "Customer",
  "2": order.orderNumber || "N/A",
  "3": order.orderNumber || "N/A",
  "4": order.orderType || "N/A",
  "5": order.branch?.name || "N/A",
};


  const payload = {
    to,
    type: "template",
    template_id: templateId,
    language:
      process.env.SMSMOJO_CUSTOMER_FINAL_CONFIRMED_TEMPLATE_LANGUAGE ||
      "en_US",
    campaign_name: "Jewellery Customer Final Confirmation",
    variables,
  };

  console.log("CUSTOMER FINAL_CONFIRMED WHATSAPP REQUEST:", {
    to,
    orderNumber: order.orderNumber,
    template_id: templateId,
  });

  return await sendWhatsAppMessage(payload);
};
