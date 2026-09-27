import pool from "../config/db";
import { sendSlackMessage } from "./slackService";

export async function notifySlackRateLimit() {
  const result = await pool.query(
    `SELECT access_token
     FROM slack_connections
     ORDER BY created_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    console.log("Slack is not connected. Skipping notification.");
    return;
  }

  const token = result.rows[0].access_token;

  // Replace this with a channel ID from your Slack workspace.
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!channel) {
    console.log("SLACK_CHANNEL_ID is not configured.");
    return;
  }

  try {
    await sendSlackMessage(
      token,
      channel,
      "⚠️ ReachInbox email hourly rate limit has been reached. Email sending has been temporarily delayed."
    );

    console.log("Slack rate-limit notification sent.");
  } catch (error) {
    console.error(
      "Slack notification failed:",
      error
    );
  }
}