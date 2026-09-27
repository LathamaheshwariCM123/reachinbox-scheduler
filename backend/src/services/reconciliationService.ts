import { emailQueue } from "../queues/emailQueue";
import pool from "../config/db";

export async function reconcileScheduledEmails() {
  console.log("Starting scheduled email reconciliation...");

  try {
    const result = await pool.query(`
      SELECT
        se.id,
        se.scheduled_at,
        se.bullmq_job_id
      FROM scheduled_emails se
      WHERE se.status = 'scheduled'
        AND se.scheduled_at > CURRENT_TIMESTAMP
    `);

    console.log(
      `Found ${result.rows.length} scheduled emails to check.`
    );

    let recreated = 0;

    for (const email of result.rows) {
      const jobId = email.bullmq_job_id || email.id;

      const existingJob = await emailQueue.getJob(jobId);

      if (existingJob) {
        console.log(
          `Job ${jobId} already exists for email ${email.id}.`
        );

        continue;
      }

      const delay = Math.max(
        new Date(email.scheduled_at).getTime() - Date.now(),
        0
      );

      const newJob = await emailQueue.add(
        "send-email",
        {
          scheduledEmailId: email.id,
        },
        {
          jobId: email.id,
          delay,
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      );

      await pool.query(
        `UPDATE scheduled_emails
         SET bullmq_job_id = $1
         WHERE id = $2`,
        [newJob.id, email.id]
      );

      recreated++;

      console.log(
        `Recreated BullMQ job ${newJob.id} for email ${email.id}.`
      );
    }

    console.log(
      `Reconciliation completed. Recreated ${recreated} jobs.`
    );
  } catch (error) {
    console.error(
      "Scheduled email reconciliation failed:",
      error
    );

    throw error;
  }
}