import { Router } from "express";
import jwt from "jsonwebtoken";

import pool from "../config/db";

import {
  getSlackOAuthUrl,
  exchangeSlackCode,
} from "../services/slackService";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/slack/connect
|--------------------------------------------------------------------------
| Start Slack OAuth for the currently logged-in user.
|
| The frontend sends the JWT as:
|
| /api/slack/connect?token=<JWT>
|
|--------------------------------------------------------------------------
*/

router.get("/connect", async (req, res) => {
  try {
    const token = req.query.token;

    if (!token || typeof token !== "string") {
      return res.status(401).json({
        message: "Authentication token required",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        message:
          "Server authentication configuration error",
      });
    }

    // ----------------------------------------------------------
    // Verify Google-login JWT
    // ----------------------------------------------------------

    let decoded: {
      userId: string;
      email: string;
    };

    try {
      decoded = jwt.verify(
        token,
        secret
      ) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      console.error(
        "Invalid authentication token:",
        error
      );

      return res.status(401).json({
        message:
          "Invalid or expired authentication token",
      });
    }

    if (!decoded.userId) {
      return res.status(401).json({
        message:
          "Invalid authentication token",
      });
    }

    // ----------------------------------------------------------
    // Verify user exists
    // ----------------------------------------------------------

    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        name
      FROM users
      WHERE id = $1
      `,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ----------------------------------------------------------
    // Create signed OAuth state
    // ----------------------------------------------------------

    /*
     * The state contains only the user ID.
     *
     * It expires after 10 minutes.
     *
     * This allows the callback to know which
     * ReachInbox user connected Slack.
     */
    const state = jwt.sign(
      {
        userId: decoded.userId,
      },
      secret,
      {
        expiresIn: "10m",
      }
    );

    // ----------------------------------------------------------
    // Generate Slack OAuth URL
    // ----------------------------------------------------------

    const url =
      getSlackOAuthUrl(state);

    return res.redirect(url);
  } catch (error) {
    console.error(
      "Slack connect error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to start Slack OAuth",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/slack/callback
|--------------------------------------------------------------------------
| Slack redirects here after authorization.
|--------------------------------------------------------------------------
*/

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    // ----------------------------------------------------------
    // Validate authorization code
    // ----------------------------------------------------------

    if (
      !code ||
      typeof code !== "string"
    ) {
      return res.status(400).json({
        message:
          "Slack authorization code missing",
      });
    }

    // ----------------------------------------------------------
    // Validate state
    // ----------------------------------------------------------

    if (
      !state ||
      typeof state !== "string"
    ) {
      return res.status(400).json({
        message:
          "Slack OAuth state missing",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        message:
          "Server authentication configuration error",
      });
    }

    // ----------------------------------------------------------
    // Verify OAuth state
    // ----------------------------------------------------------

    let decoded: {
      userId: string;
    };

    try {
      decoded = jwt.verify(
        state,
        secret
      ) as {
        userId: string;
      };
    } catch (error) {
      console.error(
        "Invalid Slack OAuth state:",
        error
      );

      return res.status(400).json({
        message:
          "Invalid or expired Slack OAuth state",
      });
    }

    if (!decoded.userId) {
      return res.status(400).json({
        message:
          "Invalid Slack OAuth state",
      });
    }

    const userId = decoded.userId;

    // ----------------------------------------------------------
    // Verify user still exists
    // ----------------------------------------------------------

    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        name
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ----------------------------------------------------------
    // Exchange Slack code for access token
    // ----------------------------------------------------------

    const data =
      await exchangeSlackCode(code);

    if (!data.access_token) {
      return res.status(400).json({
        message:
          "Slack access token was not returned",
      });
    }

    if (!data.team?.id) {
      return res.status(400).json({
        message:
          "Slack team information was not returned",
      });
    }

    // ----------------------------------------------------------
    // Save Slack connection
    // ----------------------------------------------------------

    await pool.query(
      `
      INSERT INTO slack_connections
      (
        user_id,
        team_id,
        team_name,
        bot_user_id,
        access_token
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5
      )

      ON CONFLICT (user_id)
      DO UPDATE SET
        team_id =
          EXCLUDED.team_id,

        team_name =
          EXCLUDED.team_name,

        bot_user_id =
          EXCLUDED.bot_user_id,

        access_token =
          EXCLUDED.access_token,

        updated_at =
          CURRENT_TIMESTAMP
      `,
      [
        userId,
        data.team.id,
        data.team.name,
        data.bot_user_id,
        data.access_token,
      ]
    );

    console.log(
      `Slack connection saved for user ${userId}`
    );

    // ----------------------------------------------------------
    // Redirect to frontend
    // ----------------------------------------------------------

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    return res.redirect(
      `${frontendUrl}?slack=connected`
    );
  } catch (error) {
    console.error(
      "Slack OAuth callback error:",
      error
    );

    return res.status(500).json({
      message:
        "Slack OAuth failed",
    });
  }
});

export default router;