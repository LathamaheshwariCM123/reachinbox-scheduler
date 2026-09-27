import dotenv from "dotenv";
import app from "./app";
import "./workers/emailWorker";
import { reconcileScheduledEmails } from "./services/reconciliationService";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await reconcileScheduledEmails();

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();