
const SEND_URL = process.env.SMSMOJO_SEND_MESSAGE_URL;
const API_TOKEN = process.env.SMSMOJO_API_TOKEN;

export const sendWhatsAppMessage = async (payload) => {
  if (!SEND_URL || !API_TOKEN) {
    throw new Error("SMSMOJO configuration is missing");
  }

  const response = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { message: responseText };
  }

  if (!response.ok || result.success === false) {
  console.error("SMSMOJO STATUS:", response.status);
  console.error("SMSMOJO RESPONSE:", result);

  const error = new Error(
    result.error ||
      result.message ||
      `SMSMOJO failed with HTTP ${response.status}`
  );

  error.status = response.status;
  error.providerResponse = result;

  throw error;
}

  return result;
};
