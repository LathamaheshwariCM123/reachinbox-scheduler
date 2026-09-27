import { Worker, DelayedError } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";
import pool from "../config/db";
import { sendEmail } from "../services/emailService";
import { checkHourlyRateLimit } from "../services/rateLimitService";
import { waitForSendSlot } from "../services/sendDelayService";
import { notifySlackRateLimit } from "../services/slackNotificationService";

dotenv.config();

const connection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

const worker = new Worker(
  "email-queue",

  async (job) => {
    console.log(`Processing email job: ${job.id}`);

    const { scheduledEmailId } = job.data;

    if (!scheduledEmailId) {
      throw new Error("scheduledEmailId is missing from job data");
    }

    // ---------------------------------------------------------
    // 1. Get email details
    // ---------------------------------------------------------

    const result = await pool.query(
      `SELECT
         se.id,
         se.status,
         se.scheduled_at,
         c.subject,
         c.body,
         l.email,
         l.name
       FROM scheduled_emails se
       JOIN campaigns c
         ON c.id = se.campaign_id
       JOIN leads l
         ON l.id = se.lead_id
       WHERE se.id = $1`,
      [scheduledEmailId]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `Scheduled email ${scheduledEmailId} not found`
      );
    }

    const email = result.rows[0];

    // ---------------------------------------------------------
    // 2. Idempotency check
    // ---------------------------------------------------------

    if (email.status === "sent") {
      console.log(
        `Email ${scheduledEmailId} already sent. Skipping.`
      );

      return;
    }

    if (email.status === "processing") {
      console.log(
        `Email ${scheduledEmailId} is already being processed. Skipping.`
      );

      return;
    }

    // ---------------------------------------------------------
    // 3. Claim the email
    // ---------------------------------------------------------
    //
    // Only ONE worker can change scheduled -> processing.
    //

    const claimResult = await pool.query(
      `UPDATE scheduled_emails
       SET status = 'processing'
       WHERE id = $1
         AND status = 'scheduled'
       RETURNING id`,
      [scheduledEmailId]
    );

    if (claimResult.rows.length === 0) {
      console.log(
        `Email ${scheduledEmailId} could not be claimed.`
      );

      return;
    }

    console.log(
      `Email ${scheduledEmailId} claimed by worker.`
    );

    try {
      // -------------------------------------------------------
      // 4. Wait for global minimum send delay
      // -------------------------------------------------------

      await waitForSendSlot();

      console.log(
        `Send slot available for ${scheduledEmailId}`
      );

      // -------------------------------------------------------
      // 5. Check hourly rate limit
      // -------------------------------------------------------

      const rateLimit = await checkHourlyRateLimit();

      if (!rateLimit.allowed) {
        console.log(
          `Hourly rate limit reached (${rateLimit.limit} emails).`
        );

        // Return email to scheduled state.
        await pool.query(
          `UPDATE scheduled_emails
           SET status = 'scheduled'
           WHERE id = $1
             AND status = 'processing'`,
          [scheduledEmailId]
        );

        // Slack notification must not crash worker.
        try {
          await notifySlackRateLimit();
        } catch (error) {
          console.error(
            "Slack rate-limit notification failed:",
            error
          );
        }

        // Reschedule the BullMQ job.
        const retryDelay = 60 * 1000;

        await job.moveToDelayed(
          Date.now() + retryDelay,
          job.token!
        );

        console.log(
          `Job ${job.id} rescheduled for 1 minute later.`
        );

        throw new DelayedError();
      }

      // -------------------------------------------------------
      // 6. Send email
      // -------------------------------------------------------

      console.log("Recipient:", email.email);
      console.log("Subject:", email.subject);

      const emailResult = await sendEmail(
        email.email,
        email.subject,
        email.body
      );

      console.log(
        "Ethereal message ID:",
        emailResult.messageId
      );

      if (emailResult.previewUrl) {
        console.log(
          "Ethereal preview URL:",
          emailResult.previewUrl
        );
      }

      // -------------------------------------------------------
      // 7. Mark email as sent
      // -------------------------------------------------------

      const sentResult = await pool.query(
        `UPDATE scheduled_emails
         SET status = 'sent',
             sent_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND status = 'processing'
         RETURNING id`,
        [scheduledEmailId]
      );

      if (sentResult.rows.length === 0) {
        console.warn(
          `Email ${scheduledEmailId} was sent but could not be marked as sent.`
        );

        throw new Error(
          "Email sent but database status update failed"
        );
      }

      console.log(
        `Email ${scheduledEmailId} marked as sent.`
      );
    } catch (error) {
      // -------------------------------------------------------
      // 8. Restore processing -> scheduled on failure
      // -------------------------------------------------------

      /*
       * Do NOT reset the status when the job intentionally
       * entered DelayedError state.
       */

      if (error instanceof DelayedError) {
        throw error;
      }

      await pool.query(
        `UPDATE scheduled_emails
         SET status = 'scheduled'
         WHERE id = $1
           AND status = 'processing'`,
        [scheduledEmailId]
      );

      console.error(
        `Email ${scheduledEmailId} failed:`,
        error
      );

      throw error;
    }
  },

  {
    connection,

    concurrency: Number(
      process.env.WORKER_CONCURRENCY || 10
    ),
  }
);

// -------------------------------------------------------------
// Job completed
// -------------------------------------------------------------

worker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed successfully.`
  );
});

// -------------------------------------------------------------
// Job failed
// -------------------------------------------------------------

worker.on("failed", (job, error) => {
  console.error(
    `Job ${job?.id} failed:`,
    error.message
  );
});

// -------------------------------------------------------------
// Worker error
// -------------------------------------------------------------

worker.on("error", (error) => {
  console.error(
    "Worker error:",
    error.message
  );
});

console.log(
  `Email worker started with concurrency ${
    process.env.WORKER_CONCURRENCY || 10
  }`
);

// -------------------------------------------------------------
// Graceful shutdown
// -------------------------------------------------------------

async function shutdown() {
  console.log("Shutting down worker...");

  await worker.close();
  await connection.quit();
  await pool.end();

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);