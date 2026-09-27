import pool from "../config/db";
import {
  createEmailIndex,
  indexEmail,
} from "../services/elasticsearchService";

async function reindexEmails() {
  try {
    console.log("Starting Elasticsearch re-indexing...");

    // Make sure the index and userId mapping exist
    await createEmailIndex();

    // Get all scheduled emails with their owner
    const result = await pool.query(`
      SELECT
        se.id,
        se.campaign_id,
        se.lead_id,
        se.scheduled_at,
        se.status,
        se.sent_at,

        c.user_id,
        c.subject,
        c.body,

        l.email,
        l.name

      FROM scheduled_emails se

      INNER JOIN campaigns c
        ON se.campaign_id = c.id

      INNER JOIN leads l
        ON se.lead_id = l.id

      ORDER BY se.created_at ASC
    `);

    console.log(
      `Found ${result.rows.length} emails to re-index.`
    );

    for (const email of result.rows) {
      await indexEmail({
        id: email.id,

        userId: email.user_id,

        campaignId:
          email.campaign_id,

        leadId:
          email.lead_id,

        email:
          email.email,

        name:
          email.name,

        subject:
          email.subject,

        body:
          email.body,

        status:
          email.status,

        scheduledAt:
          new Date(
            email.scheduled_at
          ).toISOString(),

        sentAt:
          email.sent_at
            ? new Date(
                email.sent_at
              ).toISOString()
            : null,
      });

      console.log(
        `Re-indexed email: ${email.id}`
      );
    }

    console.log(
      "Elasticsearch re-indexing completed successfully."
    );
  } catch (error) {
    console.error(
      "Elasticsearch re-indexing failed:",
      error
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

reindexEmails();