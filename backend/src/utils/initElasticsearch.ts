import dotenv from "dotenv";
import { createEmailIndex } from "../services/elasticsearchService";

dotenv.config();

async function init() {
  try {
    await createEmailIndex();
    console.log("Elasticsearch initialization completed");
  } catch (error) {
    console.error("Elasticsearch initialization failed:", error);
    process.exit(1);
  }
}

init();