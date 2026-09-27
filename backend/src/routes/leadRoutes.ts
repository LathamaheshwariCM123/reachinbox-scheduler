import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";

import pool from "../config/db";

import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

/*
|--------------------------------------------------------------------------
| GET /api/leads?campaign_id=...
|--------------------------------------------------------------------------
| Get leads only if the campaign belongs to the logged-in user.
*/
router.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const campaignId = req.query.campaign_id;

      if (typeof campaignId !== "string") {
        return res.status(400).json({
          message: "campaign_id is required",
        });
      }

      // First verify that the campaign belongs to this user.
      const campaignResult = await pool.query(
        `
        SELECT id
        FROM campaigns
        WHERE id = $1
          AND user_id = $2
        `,
        [campaignId, userId]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({
          message: "Campaign not found",
        });
      }

      // Now get the leads.
      const result = await pool.query(
        `
        SELECT
          id,
          email,
          name,
          created_at
        FROM leads
        WHERE campaign_id = $1
        ORDER BY created_at DESC
        `,
        [campaignId]
      );

      res.json({
        leads: result.rows,
      });
    } catch (error) {
      console.error("Get leads error:", error);

      res.status(500).json({
        message: "Failed to fetch leads",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/leads
|--------------------------------------------------------------------------
| Add one lead to a campaign owned by the logged-in user.
|--------------------------------------------------------------------------
*/
router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const {
        campaignId,
        email,
        name,
      } = req.body;

      if (!campaignId || !email) {
        return res.status(400).json({
          message:
            "campaignId and email are required",
        });
      }

      // Verify campaign ownership.
      const campaignResult = await pool.query(
        `
        SELECT id
        FROM campaigns
        WHERE id = $1
          AND user_id = $2
        `,
        [campaignId, userId]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({
          message: "Campaign not found",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO leads
          (campaign_id, email, name)
        VALUES
          ($1, $2, $3)
        ON CONFLICT (campaign_id, email)
        DO NOTHING
        RETURNING
          id,
          campaign_id,
          email,
          name,
          created_at
        `,
        [
          campaignId,
          email,
          name || null,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          message:
            "This lead already exists in the campaign",
        });
      }

      res.status(201).json({
        message: "Lead created successfully",
        lead: result.rows[0],
      });
    } catch (error) {
      console.error("Create lead error:", error);

      res.status(500).json({
        message: "Failed to create lead",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/leads/upload
|--------------------------------------------------------------------------
| Upload CSV leads into a campaign owned by the logged-in user.
|--------------------------------------------------------------------------
*/
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const campaignId = req.body.campaignId;

      if (!campaignId) {
        return res.status(400).json({
          message: "campaignId is required",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "CSV file is required",
        });
      }

      // Verify campaign ownership.
      const campaignResult = await pool.query(
        `
        SELECT id
        FROM campaigns
        WHERE id = $1
          AND user_id = $2
        `,
        [campaignId, userId]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({
          message: "Campaign not found",
        });
      }

      const csvText =
        req.file.buffer.toString("utf-8");

      let records: Array<{
        name?: string;
        email?: string;
      }>;

      try {
        records = parse(csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch (error) {
        console.error(
          "CSV parsing error:",
          error
        );

        return res.status(400).json({
          message: "Invalid CSV file",
        });
      }

      let imported = 0;
      let skipped = 0;

      for (const record of records) {
        const email =
          record.email?.trim();

        const name =
          record.name?.trim();

        // Basic validation.
        if (
          !email ||
          !email.includes("@")
        ) {
          skipped++;
          continue;
        }

        const result = await pool.query(
          `
          INSERT INTO leads
            (campaign_id, email, name)
          VALUES
            ($1, $2, $3)
          ON CONFLICT (campaign_id, email)
          DO NOTHING
          RETURNING id
          `,
          [
            campaignId,
            email,
            name || null,
          ]
        );

        if (result.rowCount === 1) {
          imported++;
        } else {
          skipped++;
        }
      }

      res.status(201).json({
        message: "Leads imported successfully",
        imported,
        skipped,
      });
    } catch (error) {
      console.error(
        "CSV upload error:",
        error
      );

      res.status(500).json({
        message: "Failed to upload leads",
      });
    }
  }
);

export default router;