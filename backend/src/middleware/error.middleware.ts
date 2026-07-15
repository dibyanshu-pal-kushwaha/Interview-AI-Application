import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/index.js";

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}

export function globalErrorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === "ZodError") {
    statusCode = 400;
    message = err.message;
  } else if (err.name === "PrismaClientKnownRequestError") {
    statusCode = 400;
    message = `Database error: ${err.message}`;
  } else if (err.name === "PrismaClientValidationError") {
    statusCode = 400;
    message = `Validation error: ${err.message}`;
  } else if (err.message) {
    message = err.message;
  }

  // Handle Multer errors
  if (err.message && err.message.includes("File too large")) {
    statusCode = 413;
    message = "File size exceeds the allowed limit";
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      statusCode,
    },
  };

  if (process.env.NODE_ENV === "development") {
    response.error.stack = err.stack;
  }

  console.error(`[ERROR] ${statusCode} - ${message}`, {
    stack: err.stack,
    name: err.name,
  });

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}
