export const successResponse = (
  res,
  message,
  data = null,
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res,
  message,
  statusCode = 500,
  error = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error:
      process.env.NODE_ENV === "development" ? error?.message || error : undefined,
  });
};