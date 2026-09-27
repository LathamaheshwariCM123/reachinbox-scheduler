import { WebClient } from "@slack/web-api";
import dotenv from "dotenv";

dotenv.config();

const slackClientId = process.env.SLACK_CLIENT_ID;
const slackClientSecret = process.env.SLACK_CLIENT_SECRET;
const slackRedirectUri = process.env.SLACK_REDIRECT_URI;

export function getSlackOAuthUrl(state: string) {
  if (!slackClientId || !slackRedirectUri) {
    throw new Error("Slack OAuth configuration is missing");
  }

  const params = new URLSearchParams({
    client_id: slackClientId,
    redirect_uri: slackRedirectUri,
    scope: "chat:write",
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string) {
  if (!slackClientId || !slackClientSecret || !slackRedirectUri) {
    throw new Error("Slack OAuth configuration is missing");
  }

  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: slackClientId,
        client_secret: slackClientSecret,
        code,
        redirect_uri: slackRedirectUri,
      }),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      data.error || "Slack OAuth failed"
    );
  }

  return data;
}

export async function sendSlackMessage(
  token: string,
  channel: string,
  message: string
) {
  const client = new WebClient(token);

  const result = await client.chat.postMessage({
    channel,
    text: message,
  });

  return result;
}