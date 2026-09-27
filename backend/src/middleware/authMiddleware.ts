import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.substring(7);

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        message: "Server authentication configuration error",
      });
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
    };

    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        message: "Invalid authentication token",
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
};