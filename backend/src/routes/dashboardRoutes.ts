import { Router } from "express";

import pool from "../config/db";

import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/dashboard/stats
|--------------------------------------------------------------------------
| Return statistics only for the logged-in user.
|--------------------------------------------------------------------------
*/

router.get(
  "/stats",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const result = await pool.query(
        `
        SELECT
          COUNT(*)::int AS total,

          COUNT(*) FILTER (
            WHERE se.status = 'scheduled'
          )::int AS scheduled,

          COUNT(*) FILTER (
            WHERE se.status = 'sent'
          )::int AS sent,

          COUNT(*) FILTER (
            WHERE se.status = 'failed'
          )::int AS failed

        FROM scheduled_emails se

        INNER JOIN campaigns c
          ON se.campaign_id = c.id

        WHERE c.user_id = $1
        `,
        [userId]
      );

      const stats = result.rows[0];

      res.json({
        total: stats.total || 0,
        scheduled: stats.scheduled || 0,
        sent: stats.sent || 0,
        failed: stats.failed || 0,
      });
    } catch (error) {
      console.error(
        "Dashboard stats error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load dashboard statistics",
      });
    }
  }
);

export default router;