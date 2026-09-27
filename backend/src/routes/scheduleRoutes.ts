import { Router } from "express";

import pool from "../config/db";
import { emailQueue } from "../queues/emailQueue";
import { indexEmail } from "../services/elasticsearchService";

import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| POST /api/schedule
|--------------------------------------------------------------------------
| Schedule an email for the logged-in user.
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      // ----------------------------------------------------------
      // Get authenticated user
      // ----------------------------------------------------------

      const userId = req.user!.userId;

      const {
        campaignId,
        leadId,
        scheduledAt,
      } = req.body;

      // ----------------------------------------------------------
      // Validate request
      // ----------------------------------------------------------

      if (
        !campaignId ||
        !leadId ||
        !scheduledAt
      ) {
        return res.status(400).json({
          message:
            "campaignId, leadId and scheduledAt are required",
        });
      }

      // ----------------------------------------------------------
      // Validate scheduled date
      // ----------------------------------------------------------

      const scheduledDate =
        new Date(scheduledAt);

      if (
        Number.isNaN(
          scheduledDate.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid scheduledAt date",
        });
      }

      // ----------------------------------------------------------
      // Scheduled time must be in the future
      // ----------------------------------------------------------

      if (
        scheduledDate.getTime() <=
        Date.now()
      ) {
        return res.status(400).json({
          message:
            "Scheduled time must be in the future",
        });
      }

      // ----------------------------------------------------------
      // Verify campaign belongs to logged-in user
      // ----------------------------------------------------------

      const campaignResult =
        await pool.query(
          `
          SELECT
            id,
            name,
            subject,
            body
          FROM campaigns
          WHERE id = $1
            AND user_id = $2
          `,
          [
            campaignId,
            userId,
          ]
        );

      if (
        campaignResult.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Campaign not found",
        });
      }

      const campaign =
        campaignResult.rows[0];

      // ----------------------------------------------------------
      // Verify lead belongs to campaign
      // ----------------------------------------------------------

      const leadResult =
        await pool.query(
          `
          SELECT
            id,
            email,
            name
          FROM leads
          WHERE id = $1
            AND campaign_id = $2
          `,
          [
            leadId,
            campaignId,
          ]
        );

      if (
        leadResult.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Lead not found for this campaign",
        });
      }

      const lead =
        leadResult.rows[0];

      // ----------------------------------------------------------
      // Insert scheduled email into PostgreSQL
      // ----------------------------------------------------------

      const insertResult =
        await pool.query(
          `
          INSERT INTO scheduled_emails
          (
            campaign_id,
            lead_id,
            scheduled_at,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            'scheduled'
          )
          RETURNING
            id,
            campaign_id,
            lead_id,
            scheduled_at,
            status,
            created_at
          `,
          [
            campaignId,
            leadId,
            scheduledDate,
          ]
        );

      const scheduledEmail =
        insertResult.rows[0];

      // ----------------------------------------------------------
      // Calculate BullMQ delay
      // ----------------------------------------------------------

      const delay =
        Math.max(
          0,
          scheduledDate.getTime() -
            Date.now()
        );

      // ----------------------------------------------------------
      // Add job to BullMQ
      // ----------------------------------------------------------

      const job =
        await emailQueue.add(
          "send-email",
          {
            scheduledEmailId:
              scheduledEmail.id,
          },
          {
            /*
             * Delay the job until scheduledAt.
             */
            delay,

            /*
             * Use PostgreSQL ID as BullMQ job ID.
             *
             * This gives us deterministic job identity
             * and helps prevent duplicate BullMQ jobs
             * for the same scheduled email.
             */
            jobId:
              scheduledEmail.id,

            /*
             * Retry failed jobs up to 3 attempts.
             *
             * Attempt 1
             *      ↓
             * failure
             *      ↓
             * wait 5 seconds
             *
             * Attempt 2
             *      ↓
             * failure
             *      ↓
             * wait 10 seconds
             *
             * Attempt 3
             *      ↓
             * failure
             *      ↓
             * permanently failed
             */
            attempts: 3,

            /*
             * Exponential retry backoff.
             *
             * 1st retry  = 5 seconds
             * 2nd retry  = 10 seconds
             */
            backoff: {
              type: "exponential",
              delay: 5000,
            },

            /*
             * Remove successful jobs after 24 hours.
             */
            removeOnComplete: {
              age:
                24 * 60 * 60,
            },

            /*
             * Keep failed jobs for 7 days.
             */
            removeOnFail: {
              age:
                7 * 24 * 60 * 60,
            },
          }
        );

      // ----------------------------------------------------------
      // Save BullMQ job ID in PostgreSQL
      // ----------------------------------------------------------

      await pool.query(
        `
        UPDATE scheduled_emails
        SET bullmq_job_id = $1
        WHERE id = $2
        `,
        [
          job.id,
          scheduledEmail.id,
        ]
      );

      // ----------------------------------------------------------
      // Index email in Elasticsearch
      // ----------------------------------------------------------

      try {
        await indexEmail({
          id:
            scheduledEmail.id,

          /*
           * Store authenticated user's ID.
           *
           * Elasticsearch search uses this
           * to isolate users.
           */
          userId:
            userId,

          campaignId:
            campaignId,

          leadId:
            leadId,

          email:
            lead.email,

          name:
            lead.name,

          subject:
            campaign.subject,

          body:
            campaign.body,

          status:
            "scheduled",

          scheduledAt:
            scheduledDate.toISOString(),

          sentAt:
            null,
        });
      } catch (error) {
        /*
         * Elasticsearch failure should NOT
         * cancel the scheduled email.
         *
         * PostgreSQL + BullMQ remain the
         * source of truth.
         */
        console.error(
          "Elasticsearch indexing error:",
          error
        );
      }

      // ----------------------------------------------------------
      // Return successful response
      // ----------------------------------------------------------

      return res.status(201).json({
        message:
          "Email scheduled successfully",

        scheduledEmail: {
          ...scheduledEmail,

          bullmq_job_id:
            job.id,
        },
      });
    } catch (error) {
      console.error(
        "Schedule email error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to schedule email",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/schedule
|--------------------------------------------------------------------------
| Get scheduled/sent emails belonging to
| the currently authenticated user.
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authMiddleware,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      // ----------------------------------------------------------
      // Get authenticated user
      // ----------------------------------------------------------

      const userId =
        req.user!.userId;

      // ----------------------------------------------------------
      // Fetch user's scheduled emails
      // ----------------------------------------------------------

      const result =
        await pool.query(
          `
          SELECT
            se.id,
            se.scheduled_at,
            se.status,
            se.sent_at,

            c.id AS campaign_id,
            c.name AS campaign_name,
            c.subject,

            l.id AS lead_id,
            l.email,
            l.name

          FROM scheduled_emails se

          INNER JOIN campaigns c
            ON se.campaign_id = c.id

          INNER JOIN leads l
            ON se.lead_id = l.id

          WHERE c.user_id = $1

          ORDER BY
            se.scheduled_at DESC
          `,
          [userId]
        );

      return res.json({
        emails:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Get scheduled emails error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch scheduled emails",
      });
    }
  }
);

export default router;