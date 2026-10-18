// Server-only Zoom integration (Server-to-Server OAuth app). One Zoom meeting
// is created per one-to-many (group) session and reused by every participant
// who books that professional + date + time slot — never import this from
// client code.

const TOKEN_URL = "https://zoom.us/oauth/token";
const MEETINGS_URL = "https://api.zoom.us/v2/users/me/meetings";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const accountId = (process.env.ZOOM_ACCOUNT_ID ?? "").trim();
  const clientId = (process.env.ZOOM_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.ZOOM_CLIENT_SECRET ?? "").trim();
  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom isn't configured (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET).",
    );
  }

  // Reuse the token until just before it expires instead of fetching one per
  // meeting — Server-to-Server OAuth tokens are valid for an hour.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${TOKEN_URL}?grant_type=account_credentials&account_id=${accountId}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    throw new Error(`Zoom token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export type ZoomMeeting = { joinUrl: string; startUrl: string; meetingId: string };

// `date` is "YYYY-MM-DD", `startTime` is "HH:mm" (24h), both in Sri Lanka time.
export async function createZoomMeeting(input: {
  topic: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}): Promise<ZoomMeeting> {
  const token = await getAccessToken();
  const res = await fetch(MEETINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      type: 2, // scheduled meeting (fixed date/time, not recurring)
      start_time: `${input.date}T${input.startTime}:00`,
      duration: input.durationMinutes,
      timezone: "Asia/Colombo",
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2, // no registration required — anyone with the link can join
        mute_upon_entry: true,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Zoom meeting creation failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { join_url: string; start_url: string; id: number };
  return { joinUrl: json.join_url, startUrl: json.start_url, meetingId: String(json.id) };
}
