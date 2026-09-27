import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db";

import campaignRoutes from "./routes/campaignRoutes";
import leadRoutes from "./routes/leadRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import slackRoutes from "./routes/slackRoutes";
import searchRoutes from "./routes/searchRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queues/emailQueue";
import authRoutes from "./routes/authRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "ReachInbox Scheduler API is running",
  });
});

app.get("/db-test", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      message: "PostgreSQL connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      status: "error",
      message: "PostgreSQL connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/dashboard", dashboardRoutes);

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

export default app;