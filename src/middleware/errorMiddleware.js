export const errorMiddleware = (error, req, res, next) => {
  console.error("=================================");
  console.error("GLOBAL ERROR");
  console.error("=================================");
  console.error("NAME:", error.name);
  console.error("MESSAGE:", error.message);
  console.error("STACK:", error.stack);
  console.error("=================================");

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};