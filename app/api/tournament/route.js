import {
  fetchTournamentData,
  TournamentApiError,
} from "@/services/tournamentApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchTournamentData({ cache: "no-store" });

    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const status =
      error instanceof TournamentApiError && error.status === 429 ? 503 : 502;

    return Response.json(
      {
        error: "Tournament data is temporarily unavailable. Please try again.",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}

