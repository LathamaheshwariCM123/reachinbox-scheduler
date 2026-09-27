import elasticsearch from "../config/elasticsearch";

const INDEX_NAME = "scheduled_emails";

export async function createEmailIndex() {
  const exists = await elasticsearch.indices.exists({
    index: INDEX_NAME,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: INDEX_NAME,
      mappings: {
        properties: {
          id: { type: "keyword" },

          // IMPORTANT:
          // Used to keep search results isolated per user.
          userId: { type: "keyword" },

          campaignId: { type: "keyword" },
          leadId: { type: "keyword" },

          email: { type: "keyword" },
          name: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },

          status: { type: "keyword" },

          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });

    console.log(`Elasticsearch index '${INDEX_NAME}' created`);
  } else {
    // Add userId mapping if the index already exists.
    try {
      await elasticsearch.indices.putMapping({
        index: INDEX_NAME,
        properties: {
          userId: { type: "keyword" },
        },
      });

      console.log("Elasticsearch userId mapping verified");
    } catch (error) {
      console.error(
        "Failed to update Elasticsearch mapping:",
        error
      );
    }
  }
}

export async function indexEmail(email: {
  id: string;

  // IMPORTANT
  userId: string;

  campaignId: string;
  leadId: string;

  email: string;
  name?: string;

  subject: string;
  body: string;

  status: string;

  scheduledAt: string;
  sentAt?: string | null;
}) {
  await elasticsearch.index({
    index: INDEX_NAME,

    id: email.id,

    document: email,
  });

  console.log(
    `Email ${email.id} indexed in Elasticsearch`
  );
}

export async function searchEmails(
  query: string,
  userId: string
) {
  const result = await elasticsearch.search({
    index: INDEX_NAME,

    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,

              fields: [
                "email",
                "name",
                "subject",
                "body",
              ],
            },
          },
        ],

        // IMPORTANT:
        // Only return emails belonging
        // to the logged-in user.
        filter: [
          {
            term: {
              userId: userId,
            },
          },
        ],
      },
    },
  });

  return result.hits.hits;
}