import { Router } from "express";
import pool from "../config/db";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/campaigns
|--------------------------------------------------------------------------
| Get campaigns belonging only to the logged-in user.
*/
router.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const result = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.subject,
          c.body,
          c.status,
          c.created_at,
          COUNT(l.id)::int AS lead_count
        FROM campaigns c
        LEFT JOIN leads l
          ON c.id = l.campaign_id
        WHERE c.user_id = $1
        GROUP BY
          c.id,
          c.name,
          c.subject,
          c.body,
          c.status,
          c.created_at
        ORDER BY c.created_at DESC
        `,
        [userId]
      );

      res.json({
        campaigns: result.rows,
      });
    } catch (error) {
      console.error("Get campaigns error:", error);

      res.status(500).json({
        message: "Failed to fetch campaigns",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/campaigns
|--------------------------------------------------------------------------
| Create a campaign for the logged-in user.
|
| IMPORTANT:
| We do NOT trust user_id from req.body.
| The user ID comes from the verified JWT.
*/
router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const {
        name,
        subject,
        body,
      } = req.body;

      if (!name || !subject || !body) {
        return res.status(400).json({
          message:
            "Campaign name, subject and body are required",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO campaigns
          (user_id, name, subject, body)
        VALUES
          ($1, $2, $3, $4)
        RETURNING
          id,
          user_id,
          name,
          subject,
          body,
          status,
          created_at
        `,
        [
          userId,
          name,
          subject,
          body,
        ]
      );

      res.status(201).json({
        message: "Campaign created successfully",
        campaign: result.rows[0],
      });
    } catch (error) {
      console.error("Create campaign error:", error);

      res.status(500).json({
        message: "Failed to create campaign",
      });
    }
  }
);

export default router;