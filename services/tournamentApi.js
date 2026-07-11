export const TOURNAMENT_API_URL =
  "https://nsc-world-cup.netlify.app/api/data";

export class TournamentApiError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, cause?: unknown}=} options
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "TournamentApiError";
    this.status = options.status;
  }
}

/** @param {unknown} value @param {string} message */
function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TournamentApiError(message);
  }
}

/**
 * Validate the minimum API shape used by the calculator.
 * @param {unknown} payload
 * @returns {asserts payload is import("@/types/tournament").TournamentData}
 */
export function validateTournamentData(payload) {
  assertObject(payload, "Tournament API returned an invalid payload.");
  assertObject(payload.teams, "Tournament API payload has no valid teams object.");
  if (!Array.isArray(payload.matches)) {
    throw new TournamentApiError("Tournament API payload has no valid matches array.");
  }
  if (typeof payload.updatedAt !== "string") {
    throw new TournamentApiError("Tournament API payload has no update timestamp.");
  }

  for (const [teamId, team] of Object.entries(payload.teams)) {
    assertObject(team, `Team ${teamId} is invalid.`);
    if (typeof team.name !== "string" || typeof team.group !== "string") {
      throw new TournamentApiError(`Team ${teamId} is missing a name or group.`);
    }
  }

  const matchIds = new Set();
  for (const match of payload.matches) {
    assertObject(match, "Tournament API contains an invalid match.");
    if (typeof match.id !== "string" || matchIds.has(match.id)) {
      throw new TournamentApiError("Tournament API contains a missing or duplicate match ID.");
    }
    matchIds.add(match.id);
    if (typeof match.stage !== "string" || typeof match.status !== "string") {
      throw new TournamentApiError(`Match ${match.id} is missing stage or status.`);
    }
  }
}

/**
 * Fetch current tournament data. A custom fetch implementation supports tests.
 * @param {{fetchImpl?: typeof fetch, signal?: AbortSignal, cache?: RequestCache, next?: object}=} options
 * @returns {Promise<import("@/types/tournament").TournamentData>}
 */
export async function fetchTournamentData(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;

  try {
    response = await fetchImpl(TOURNAMENT_API_URL, {
      signal: options.signal,
      cache: options.cache ?? "no-store",
      next: options.next,
    });
  } catch (cause) {
    throw new TournamentApiError("Unable to reach the tournament data service.", {
      cause,
    });
  }

  if (!response.ok) {
    throw new TournamentApiError("Tournament data service returned an error.", {
      status: response.status,
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new TournamentApiError("Tournament data service returned invalid JSON.", {
      cause,
    });
  }

  validateTournamentData(payload);
  return payload;
}
