import { emailQueue } from "./emailQueue";

async function testQueue() {
  const job = await emailQueue.add(
    "test-email",
    {
      message: "Hello from ReachInbox BullMQ"
    },
    {
      delay: 5000
    }
  );

  console.log("Job created:", job.id);

  await emailQueue.close();
}

testQueue().catch((error) => {
  console.error("Queue test failed:", error);
});