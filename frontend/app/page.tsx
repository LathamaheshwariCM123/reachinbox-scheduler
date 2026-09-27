"use client";

import { useEffect, useState } from "react";

type Email = {
  id: string;
  campaign_name: string;
  subject: string;
  email: string;
  name: string | null;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
};

type Stats = {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  lead_count: number;
  created_at: string;
};

type Lead = {
  id: string;
  email: string;
  name: string | null;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  google_id: string | null;
};

const API_URL = "https://reachinbox-scheduler-qan6.onrender.com";

export default function Home() {
  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const [activeTab, setActiveTab] = useState("dashboard");

  // ============================================================
  // DASHBOARD
  // ============================================================

  const [stats, setStats] = useState<Stats>({
    scheduled: 0,
    sent: 0,
    failed: 0,
    total: 0,
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // ============================================================
  // CAMPAIGNS
  // ============================================================

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");

  // ============================================================
  // LEADS
  // ============================================================

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState("");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");

  // ============================================================
  // SCHEDULING
  // ============================================================

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");

  // ============================================================
  // SEARCH
  // ============================================================

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [searching, setSearching] = useState(false);

  // ============================================================
  // GOOGLE AUTHENTICATION
  // ============================================================

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const tokenFromUrl = params.get("token");

        let token = tokenFromUrl;

        // Google redirected back with token
        if (tokenFromUrl) {
          localStorage.setItem(
            "authToken",
            tokenFromUrl
          );

          // Remove token from browser URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        } else {
          // Check existing login
          token =
            localStorage.getItem("authToken");
        }

        // User is not logged in
        if (!token) {
          setAuthLoading(false);
          return;
        }

        setAuthToken(token);

        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          localStorage.removeItem(
            "authToken"
          );

          setAuthToken(null);
          setCurrentUser(null);
          setAuthLoading(false);

          return;
        }

        const data =
          await response.json();

        setCurrentUser(data.user);
      } catch (error) {
        console.error(
          "Authentication error:",
          error
        );

        localStorage.removeItem(
          "authToken"
        );

        setAuthToken(null);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    authenticateUser();
  }, []);

  // ============================================================
  // LOAD DASHBOARD STATS
  // ============================================================

  const loadStats = async () => {
  if (!authToken) {
    setStats({
      scheduled: 0,
      sent: 0,
      failed: 0,
      total: 0,
    });
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/dashboard/stats`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load statistics");
    }

    const data = await response.json();

    setStats({
      scheduled: data.scheduled || 0,
      sent: data.sent || 0,
      failed: data.failed || 0,
      total: data.total || 0,
    });
  } catch (error) {
    console.error("Stats error:", error);
  }
};
  // ============================================================
  // LOAD EMAILS
  // ============================================================

  const loadEmails = async () => {
  if (!authToken) {
    setEmails([]);
    return;
  }

  try {
    setLoadingEmails(true);

    const response = await fetch(
      `${API_URL}/api/schedule`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load emails");
    }

    const data = await response.json();

    setEmails(data.emails || []);
  } catch (error) {
    console.error("Email loading error:", error);
    setEmails([]);
  } finally {
    setLoadingEmails(false);
  }
};
  // ============================================================
  // LOAD CAMPAIGNS
  // ============================================================

  const loadCampaigns = async () => {
    try {
      setLoadingCampaigns(true);

      if (!authToken) {
        setCampaigns([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/campaigns`,
        {
          headers: {
            Authorization:
              `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load campaigns"
        );
      }

      const data =
        await response.json();

      setCampaigns(
        data.campaigns || []
      );
    } catch (error) {
      console.error(
        "Campaign loading error:",
        error
      );

      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    if (
      !authLoading &&
      authToken
    ) {
      loadStats();
      loadEmails();
      loadCampaigns();
    }

    if (
      !authLoading &&
      !authToken
    ) {
      setStats({
        scheduled: 0,
        sent: 0,
        failed: 0,
        total: 0,
      });

      setEmails([]);
      setCampaigns([]);
    }
  }, [authLoading, authToken]);

  // ============================================================
  // CREATE CAMPAIGN
  // ============================================================

  const createCampaign = async () => {
    if (!currentUser || !authToken) {
      alert(
        "Please login with Google first."
      );

      return;
    }

    if (
      !campaignName ||
      !campaignSubject ||
      !campaignBody
    ) {
      alert(
        "Please fill all campaign fields."
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/campaigns`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${authToken}`,
          },

          /*
           * user_id is no longer trusted by
           * the backend.
           *
           * The backend gets the user ID
           * directly from the JWT.
           */
          body: JSON.stringify({
            name: campaignName,
            subject: campaignSubject,
            body: campaignBody,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Failed to create campaign."
        );

        return;
      }

      alert(
        "Campaign created successfully."
      );

      setCampaignName("");
      setCampaignSubject("");
      setCampaignBody("");

      await loadCampaigns();
    } catch (error) {
      console.error(
        "Create campaign error:",
        error
      );

      alert(
        "Something went wrong."
      );
    }
  };

  // ============================================================
  // LOAD LEADS
  // ============================================================

  const loadLeads = async (
    campaignId: string
  ) => {
    setSelectedCampaign(
      campaignId
    );

    setSelectedLead("");

    if (!campaignId) {
      setLeads([]);
      return;
    }

    try {
      if (!authToken) {
        setLeads([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/leads?campaign_id=${campaignId}`,
        {
          headers: {
            Authorization:
              `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load leads"
        );
      }

      const data =
        await response.json();

      setLeads(data.leads || []);
    } catch (error) {
      console.error(
        "Lead loading error:",
        error
      );

      setLeads([]);
    }
  };

  // ============================================================
  // UPLOAD CSV
  // ============================================================

  const uploadCSV = async () => {
    if (!authToken) {
      alert(
        "Please login with Google first."
      );

      return;
    }

    if (!uploadFile) {
      alert(
        "Please select a CSV file."
      );

      return;
    }

    if (!selectedCampaign) {
      alert(
        "Please select a campaign."
      );

      return;
    }

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        uploadFile
      );

      formData.append(
        "campaignId",
        selectedCampaign
      );

      const response = await fetch(
        `${API_URL}/api/leads/upload`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${authToken}`,
          },

          /*
           * Do NOT set Content-Type manually.
           * Browser adds multipart boundary.
           */
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setUploadMessage(
          data.message ||
            "Upload failed."
        );

        return;
      }

      setUploadMessage(
        `Successfully imported ${data.imported} leads. Skipped ${data.skipped} duplicate or invalid rows.`
      );

      await loadLeads(
        selectedCampaign
      );

      await loadCampaigns();

      setUploadFile(null);
    } catch (error) {
      console.error(
        "CSV upload error:",
        error
      );

      setUploadMessage(
        "CSV upload failed."
      );
    }
  };

  // ============================================================
  // SCHEDULE EMAIL
  // ============================================================

  const scheduleEmail = async () => {
    if (!authToken || !currentUser) {
      alert(
        "Please login with Google first."
      );

      return;
    }

    if (!selectedCampaign) {
      alert(
        "Please select a campaign."
      );

      return;
    }

    if (!selectedLead) {
      alert(
        "Please select a lead."
      );

      return;
    }

    if (!scheduleDate) {
      alert(
        "Please select a date and time."
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/schedule`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },

           

          body: JSON.stringify({
            campaignId:
              selectedCampaign,

            leadId:
              selectedLead,

            scheduledAt:
              new Date(
                scheduleDate
              ).toISOString(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setScheduleMessage(
          data.message ||
            "Scheduling failed."
        );

        return;
      }

      setScheduleMessage(
        "Email scheduled successfully."
      );

      setScheduleDate("");

      await loadEmails();
      await loadStats();
    } catch (error) {
      console.error(
        "Schedule error:",
        error
      );

      setScheduleMessage(
        "Failed to schedule email."
      );
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const searchEmails = async () => {
    if (!authToken) {
      alert(
        "Please login with Google first."
      );

      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);

      const response = await fetch(
        `${API_URL}/api/search/emails?q=${encodeURIComponent(
          searchQuery
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Search failed"
        );
      }

      const data =
        await response.json();

      setSearchResults(
        data.emails || []
      );
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ============================================================
  // GOOGLE LOGIN
  // ============================================================

  const loginWithGoogle = () => {
    window.location.href =
      `${API_URL}/api/auth/google`;
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = () => {
    localStorage.removeItem(
      "authToken"
    );

    setAuthToken(null);
    setCurrentUser(null);

    setCampaigns([]);
    setEmails([]);
    setLeads([]);

    setStats({
      scheduled: 0,
      sent: 0,
      failed: 0,
      total: 0,
    });

    window.location.href = "/";
  };

  // ============================================================
  // AUTH LOADING
  // ============================================================

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">

          <h1 className="text-2xl font-semibold text-gray-900">
            Loading ReachInbox...
          </h1>

          <p className="text-gray-500 mt-2">
            Checking authentication
          </p>

        </div>
      </main>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <main className="min-h-screen bg-gray-50 flex">

      {/* ======================================================
          SIDEBAR
      ======================================================= */}

      <aside className="w-64 bg-white border-r min-h-screen p-5">

        {/* LOGO */}

        <div className="mb-8">

          <h1 className="text-2xl font-bold text-gray-900">
            ReachInbox
          </h1>

          <p className="text-sm text-gray-500">
            Email Scheduler
          </p>

        </div>

        {/* USER / GOOGLE LOGIN */}

        {currentUser ? (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">

            <p className="text-sm font-semibold text-gray-900">
              {currentUser.name ||
                "User"}
            </p>

            <p className="text-xs text-gray-500 mt-1 break-all">
              {currentUser.email}
            </p>

            <button
              onClick={logout}
              className="mt-3 text-xs text-red-600 hover:underline"
            >
              Logout
            </button>

          </div>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="w-full mb-6 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Continue with Google
          </button>
        )}

        {/* NAVIGATION */}

        <nav className="space-y-2">

          <button
            onClick={() =>
              setActiveTab(
                "dashboard"
              )
            }
            className={`w-full text-left px-4 py-2 rounded-lg ${
              activeTab ===
              "dashboard"
                ? "bg-gray-100 text-black font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "campaigns"
              )
            }
            className={`w-full text-left px-4 py-2 rounded-lg ${
              activeTab ===
              "campaigns"
                ? "bg-gray-100 text-black font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Campaigns
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "schedule"
              )
            }
            className={`w-full text-left px-4 py-2 rounded-lg ${
              activeTab ===
              "schedule"
                ? "bg-gray-100 text-black font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Schedule
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "search"
              )
            }
            className={`w-full text-left px-4 py-2 rounded-lg ${
              activeTab ===
              "search"
                ? "bg-gray-100 text-black font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Search
          </button>

        </nav>

        {/* SLACK */}

        <div className="mt-8">

          <button
            onClick={() => {
              if (!authToken) {
                alert(
                  "Please login with Google first."
                );

                return;
              }

              window.location.href =
                `${API_URL}/api/slack/connect?token=${encodeURIComponent(
                  authToken
                )}`;
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
          >
            Connect Slack
          </button>

        </div>

        {/* BULL BOARD */}

        <div className="mt-3">

          <a
            href={`${API_URL}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
          >
            Queue Dashboard
          </a>

        </div>

      </aside>

      {/* ======================================================
          MAIN CONTENT
      ======================================================= */}

      <section className="flex-1 p-8">

        {/* ====================================================
            DASHBOARD
        ===================================================== */}

        {activeTab ===
          "dashboard" && (
          <div>

            <div className="mb-8">

              <h2 className="text-3xl font-bold text-gray-900">
                Dashboard
              </h2>

              <p className="text-gray-500 mt-1">
                Manage your email campaigns
              </p>

            </div>

            {/* STATS */}

            <div className="grid grid-cols-4 gap-5 mb-8">

              <div className="bg-white rounded-xl border p-5">

                <p className="text-sm text-gray-500">
                  Total
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.total}
                </p>

              </div>

              <div className="bg-white rounded-xl border p-5">

                <p className="text-sm text-gray-500">
                  Scheduled
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.scheduled}
                </p>

              </div>

              <div className="bg-white rounded-xl border p-5">

                <p className="text-sm text-gray-500">
                  Sent
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.sent}
                </p>

              </div>

              <div className="bg-white rounded-xl border p-5">

                <p className="text-sm text-gray-500">
                  Failed
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.failed}
                </p>

              </div>

            </div>

            {/* EMAIL TABLE */}

            <div className="bg-white rounded-xl border">

              <div className="p-5 border-b">

                <h3 className="font-semibold text-gray-900">
                  Scheduled & Sent Emails
                </h3>

              </div>

              {loadingEmails ? (
                <div className="p-8 text-center text-gray-500">
                  Loading emails...
                </div>
              ) : emails.length ===
                0 ? (
                <div className="p-8 text-center text-gray-500">
                  No scheduled emails yet.
                </div>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full text-sm">

                    <thead className="bg-gray-50">

                      <tr>

                        <th className="text-left p-4 text-gray-700">
                          Campaign
                        </th>

                        <th className="text-left p-4 text-gray-700">
                          Recipient
                        </th>

                        <th className="text-left p-4 text-gray-700">
                          Subject
                        </th>

                        <th className="text-left p-4 text-gray-700">
                          Scheduled
                        </th>

                        <th className="text-left p-4 text-gray-700">
                          Status
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {emails.map(
                        (email) => (
                          <tr
                            key={email.id}
                            className="border-t"
                          >

                            <td className="p-4 text-gray-900">
                              {
                                email.campaign_name
                              }
                            </td>

                            <td className="p-4 text-gray-900">
                              {email.email}
                            </td>

                            <td className="p-4 text-gray-900">
                              {email.subject}
                            </td>

                            <td className="p-4 text-gray-700">
                              {new Date(
                                email.scheduled_at
                              ).toLocaleString()}
                            </td>

                            <td className="p-4">

                              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                {email.status}
                              </span>

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </div>

          </div>
        )}

        {/* ====================================================
            CAMPAIGNS
        ===================================================== */}

        {activeTab ===
          "campaigns" && (
          <div>

            <div className="mb-8">

              <h2 className="text-3xl font-bold text-gray-900">
                Campaigns
              </h2>

              <p className="text-gray-500 mt-1">
                Create and manage email campaigns
              </p>

            </div>

            {/* CREATE CAMPAIGN */}

            <div className="bg-white border rounded-xl p-6 mb-8">

              <h3 className="text-lg font-semibold text-gray-900 mb-5">
                Create Campaign
              </h3>

              <div className="space-y-4">

                <input
                  type="text"
                  placeholder="Campaign name"
                  value={campaignName}
                  onChange={(e) =>
                    setCampaignName(
                      e.target.value
                    )
                  }
                  className="w-full border rounded-lg px-4 py-3 text-gray-900"
                />

                <input
                  type="text"
                  placeholder="Email subject"
                  value={campaignSubject}
                  onChange={(e) =>
                    setCampaignSubject(
                      e.target.value
                    )
                  }
                  className="w-full border rounded-lg px-4 py-3 text-gray-900"
                />

                <textarea
                  placeholder="Email body"
                  value={campaignBody}
                  onChange={(e) =>
                    setCampaignBody(
                      e.target.value
                    )
                  }
                  rows={6}
                  className="w-full border rounded-lg px-4 py-3 text-gray-900"
                />

                <button
                  onClick={
                    createCampaign
                  }
                  className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800"
                >
                  Create Campaign
                </button>

              </div>

            </div>

            {/* EXISTING CAMPAIGNS */}

            <div className="bg-white border rounded-xl">

              <div className="p-5 border-b">

                <h3 className="font-semibold text-gray-900">
                  Existing Campaigns
                </h3>

              </div>

              {loadingCampaigns ? (
                <div className="p-8 text-center text-gray-500">
                  Loading campaigns...
                </div>
              ) : campaigns.length ===
                0 ? (
                <div className="p-8 text-center text-gray-500">
                  No campaigns found.
                </div>
              ) : (
                <div>

                  {campaigns.map(
                    (campaign) => (
                      <div
                        key={
                          campaign.id
                        }
                        className="p-5 border-b last:border-b-0"
                      >

                        <div className="flex justify-between">

                          <div>

                            <h4 className="font-semibold text-gray-900">
                              {
                                campaign.name
                              }
                            </h4>

                            <p className="text-sm text-gray-500 mt-1">
                              {
                                campaign.subject
                              }
                            </p>

                            <p className="text-sm text-gray-500 mt-1">
                              {
                                campaign.lead_count
                              }{" "}
                              leads
                            </p>

                          </div>

                          <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full h-fit">
                            {
                              campaign.status
                            }
                          </span>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </div>

          </div>
        )}

        {/* ====================================================
            SCHEDULE
        ===================================================== */}

        {activeTab ===
          "schedule" && (
          <div>

            <div className="mb-8">

              <h2 className="text-3xl font-bold text-gray-900">
                Schedule Email
              </h2>

              <p className="text-gray-500 mt-1">
                Schedule emails for your leads
              </p>

            </div>

            {/* SCHEDULE FORM */}

            <div className="bg-white border rounded-xl p-6 max-w-2xl">

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign
              </label>

              <select
                value={
                  selectedCampaign
                }
                onChange={(e) =>
                  loadLeads(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-4 py-3 mb-5 text-gray-900"
              >

                <option value="">
                  Select campaign
                </option>

                {campaigns.map(
                  (campaign) => (
                    <option
                      key={
                        campaign.id
                      }
                      value={
                        campaign.id
                      }
                    >
                      {
                        campaign.name
                      }
                    </option>
                  )
                )}

              </select>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead
              </label>

              <select
                value={selectedLead}
                onChange={(e) =>
                  setSelectedLead(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-4 py-3 mb-5 text-gray-900"
              >

                <option value="">
                  Select lead
                </option>

                {leads.map(
                  (lead) => (
                    <option
                      key={lead.id}
                      value={lead.id}
                    >
                      {lead.name
                        ? `${lead.name} - ${lead.email}`
                        : lead.email}
                    </option>
                  )
                )}

              </select>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule date & time
              </label>

              <input
                type="datetime-local"
                value={
                  scheduleDate
                }
                onChange={(e) =>
                  setScheduleDate(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-4 py-3 mb-5 text-gray-900"
              />

              <button
                onClick={
                  scheduleEmail
                }
                className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800"
              >
                Schedule Email
              </button>

              {scheduleMessage && (
                <p className="mt-4 text-sm text-gray-600">
                  {
                    scheduleMessage
                  }
                </p>
              )}

            </div>

            {/* CSV */}

            <div className="bg-white border rounded-xl p-6 max-w-2xl mt-6">

              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Import Leads
              </h3>

              <p className="text-sm text-gray-500 mb-4">
                CSV format: name,email
              </p>

              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) =>
                  setUploadFile(
                    e.target.files?.[0] ||
                      null
                  )
                }
                className="mb-4"
              />

              <br />

              <button
                onClick={uploadCSV}
                className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800"
              >
                Upload Leads
              </button>

              {uploadMessage && (
                <p className="mt-4 text-sm text-gray-600">
                  {
                    uploadMessage
                  }
                </p>
              )}

            </div>

          </div>
        )}

        {/* ====================================================
            SEARCH
        ===================================================== */}

        {activeTab ===
          "search" && (
          <div>

            <div className="mb-8">

              <h2 className="text-3xl font-bold text-gray-900">
                Search Emails
              </h2>

              <p className="text-gray-500 mt-1">
                Search scheduled and sent emails
              </p>

            </div>

            <div className="flex gap-3 mb-8 max-w-2xl">

              <input
                type="text"
                placeholder="Search email, name, subject..."
                value={
                  searchQuery
                }
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    searchEmails();
                  }
                }}
                className="flex-1 border rounded-lg px-4 py-3 text-gray-900"
              />

              <button
                onClick={
                  searchEmails
                }
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
              >
                Search
              </button>

            </div>

            {searching ? (
              <div className="text-gray-500">
                Searching...
              </div>
            ) : searchQuery &&
              searchResults.length ===
                0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
                No results found.
              </div>
            ) : (
              <div className="bg-white border rounded-xl">

                {searchResults.map(
                  (email) => (
                    <div
                      key={email.id}
                      className="p-5 border-b last:border-b-0"
                    >

                      <div className="flex justify-between">

                        <div>

                          <h4 className="font-semibold text-gray-900">
                            {
                              email.subject
                            }
                          </h4>

                          <p className="text-sm text-gray-500 mt-1">
                            {email.name ||
                              "Unknown"}{" "}
                            —{" "}
                            {
                              email.email
                            }
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            Campaign:{" "}
                            {
                              email.campaign_name
                            }
                          </p>

                        </div>

                        <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full h-fit">
                          {
                            email.status
                          }
                        </span>

                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </div>
        )}

      </section>

    </main>
  );
}
