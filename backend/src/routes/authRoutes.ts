import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../config/db";

const router = Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Temporary OAuth state storage for local development
const oauthStates = new Set<string>();

// Start Google OAuth
router.get("/google", (_req, res) => {
  const state = crypto.randomBytes(32).toString("hex");

  oauthStates.add(state);

  const authUrl = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: [
      "openid",
      "email",
      "profile",
    ],
    state,
    prompt: "select_account",
  });

  res.redirect(authUrl);
});

// Google OAuth callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (
      typeof code !== "string" ||
      typeof state !== "string"
    ) {
      return res.status(400).send("Invalid Google OAuth request");
    }

    if (!oauthStates.has(state)) {
      return res.status(400).send("Invalid OAuth state");
    }

    oauthStates.delete(state);

    const { tokens } =
      await googleClient.getToken(code);

    googleClient.setCredentials(tokens);

    if (!tokens.id_token) {
      return res.status(400).send(
        "Google did not return an ID token"
      );
    }

    const ticket =
      await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    const payload =
      ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).send(
        "Unable to retrieve Google user information"
      );
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || null;

    // Find existing user
    let result = await pool.query(
      `SELECT id, email, name, google_id
       FROM users
       WHERE google_id = $1
          OR email = $2
       LIMIT 1`,
      [googleId, email]
    );

    let user;

    if (result.rows.length === 0) {
      // Create new user
      result = await pool.query(
        `INSERT INTO users
         (email, name, google_id)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, google_id`,
        [email, name, googleId]
      );

      user = result.rows[0];
    } else {
      // Existing user
      user = result.rows[0];

      if (!user.google_id) {
        const updated =
          await pool.query(
            `UPDATE users
             SET google_id = $1,
                 name = COALESCE($2, name)
             WHERE id = $3
             RETURNING id, email, name, google_id`,
            [googleId, name, user.id]
          );

        user = updated.rows[0];
      }
    }

    const secret =
      process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      secret,
      {
        expiresIn: "7d",
      }
    );

    // Redirect to frontend with token
    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    res.redirect(
      `${frontendUrl}?token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error(
      "Google OAuth error:",
      error
    );

    res.status(500).send(
      "Google authentication failed"
    );
  }
});


// Get currently authenticated user
router.get("/me", async (req, res) => {
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
      return res.status(500).json({
        message: "JWT_SECRET is not configured",
      });
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
    };

    const result = await pool.query(
      `SELECT id, email, name, google_id
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
});

export default router;