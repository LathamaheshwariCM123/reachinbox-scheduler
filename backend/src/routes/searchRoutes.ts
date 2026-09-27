import { Router } from "express";

import {
  searchEmails,
} from "../services/elasticsearchService";

import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| GET /api/search/emails
|--------------------------------------------------------------------------
| Search emails belonging only to the logged-in user.
|--------------------------------------------------------------------------
*/

router.get(
  "/emails",
  authMiddleware,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const userId =
        req.user!.userId;

      const query =
        String(
          req.query.q || ""
        ).trim();

      if (!query) {
        return res.status(400).json({
          message:
            "Search query is required",
        });
      }

      const results =
        await searchEmails(
          query,
          userId
        );

      const emails =
        results.map(
          (hit: any) => ({
            id: hit._id,

            ...hit._source,
          })
        );

      return res.json({
        query,

        count:
          emails.length,

        emails,
      });
    } catch (error) {
      console.error(
        "Email search error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to search emails",
      });
    }
  }
);

export default router;