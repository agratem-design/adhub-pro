/**
 * Team Assignment & Smart Distribution Utility
 * 
 * Centralized logic for matching billboards to the optimal installation / removal team.
 * Strictly focuses on Team Priority & Rank, Specialized Sizes & Cities, and Friend Company Ownership.
 */

export interface InstallationTeamModel {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
  priority?: number;
  friend_company_id?: string | null;
  friend_company_ids?: string[] | null;
  phone_number?: string | null;
}

export interface BillboardModel {
  ID: number;
  Size?: string | null;
  City?: string | null;
  friend_company_id?: string | null;
  Billboard_Name?: string | null;
  [key: string]: any;
}

/**
 * Normalizes text for robust Arabic & size matching
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a team specializes in a given billboard size.
 * If team has no sizes configured (empty array), it is considered universal (supports all sizes).
 */
export function matchesTeamSize(teamSizes: string[] | null | undefined, billboardSize: string | null | undefined): boolean {
  if (!teamSizes || teamSizes.length === 0) return true;
  if (!billboardSize) return true;
  const normSize = normalizeText(billboardSize);
  return teamSizes.some((s) => normalizeText(s) === normSize);
}

/**
 * Checks if a team covers a given billboard city.
 * If team has no cities configured (empty array), it is considered universal (covers all cities).
 */
export function matchesTeamCity(teamCities: string[] | null | undefined, billboardCity: string | null | undefined): boolean {
  if (!teamCities || teamCities.length === 0) return true;
  if (!billboardCity) return true;
  const normCity = normalizeText(billboardCity);
  return teamCities.some((c) => normalizeText(c) === normCity);
}

/**
 * Checks if a team is linked to a specific friend company.
 */
export function matchesFriendCompany(team: any, companyId: string | null | undefined): boolean {
  if (!companyId) return false;
  if (team.friend_company_id === companyId) return true;
  if (Array.isArray(team.friend_company_ids) && team.friend_company_ids.includes(companyId)) return true;
  return false;
}

/**
 * Checks if a team is a dedicated friend company team (has linked companies).
 */
export function isFriendCompanyTeam(team: any): boolean {
  const hasSingle = !!team.friend_company_id;
  const hasMultiple = Array.isArray(team.friend_company_ids) && team.friend_company_ids.length > 0;
  return hasSingle || hasMultiple;
}

/**
 * Sorts teams by priority descending (highest priority / rank first).
 */
export function sortTeamsByPriority<T extends { priority?: number }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
}

/**
 * Finds the optimal team for a billboard removal task.
 * 
 * Rules:
 * 1. If billboard belongs to a friend company, prioritize teams specifically linked to that company (by priority DESC).
 * 2. If billboard is general (no friend company), prioritize GENERAL teams (teams not tied to friend companies) matching size & city (by priority DESC).
 * 3. Fallback to any team matching size & city (by priority DESC).
 * 4. Fallback to any general team matching size.
 * 5. Fallback to any team matching size.
 * 6. Final fallback: highest priority team overall.
 */
export function findOptimalTeamForRemoval(
  teams: any[],
  billboardSize: string | null | undefined,
  billboardCity: string | null | undefined,
  billboardCompanyId: string | null | undefined
): any {
  if (!teams || teams.length === 0) return null;
  const sorted = sortTeamsByPriority(teams);

  // 1. If billboard is owned by a friend company, match teams assigned to that company first
  if (billboardCompanyId) {
    const companyTeam = sorted.find((t) => {
      if (!matchesFriendCompany(t, billboardCompanyId)) return false;
      return matchesTeamSize(t.sizes, billboardSize) && matchesTeamCity(t.cities, billboardCity);
    });
    if (companyTeam) return companyTeam;
  }

  // 2. If billboard is general (or no friend team matched), prioritize GENERAL teams matching size & city
  const generalTeamCitySize = sorted.find((t) => {
    if (isFriendCompanyTeam(t)) return false; // Exclude friend company teams for general billboards
    return matchesTeamSize(t.sizes, billboardSize) && matchesTeamCity(t.cities, billboardCity);
  });
  if (generalTeamCitySize) return generalTeamCitySize;

  // 3. Fallback: Any team matching size & city (ordered by priority)
  const anyTeamCitySize = sorted.find((t) => {
    return matchesTeamSize(t.sizes, billboardSize) && matchesTeamCity(t.cities, billboardCity);
  });
  if (anyTeamCitySize) return anyTeamCitySize;

  // 4. Fallback: General team matching size only (ordered by priority)
  const generalTeamSizeOnly = sorted.find((t) => {
    if (isFriendCompanyTeam(t)) return false;
    return matchesTeamSize(t.sizes, billboardSize);
  });
  if (generalTeamSizeOnly) return generalTeamSizeOnly;

  // 5. Fallback: Any team matching size only
  const anyTeamSizeOnly = sorted.find((t) => {
    return matchesTeamSize(t.sizes, billboardSize);
  });
  if (anyTeamSizeOnly) return anyTeamSizeOnly;

  // 6. Final fallback: Highest priority general team, or top priority team
  const topGeneralTeam = sorted.find((t) => !isFriendCompanyTeam(t));
  return topGeneralTeam || sorted[0];
}

/**
 * Finds the optimal team for an installation task.
 */
export function findOptimalTeamForInstallation(
  teams: any[],
  billboardSize: string | null | undefined,
  billboardCity: string | null | undefined,
  billboardCompanyId: string | null | undefined
): any {
  return findOptimalTeamForRemoval(teams, billboardSize, billboardCity, billboardCompanyId);
}

/**
 * Groups a collection of billboards into team assignments based on optimal matching.
 */
export function groupBillboardsByOptimalTeam(
  billboards: BillboardModel[],
  teams: any[]
): Map<string, { team: any; billboardIds: number[]; billboards: BillboardModel[] }> {
  const result = new Map<string, { team: any; billboardIds: number[]; billboards: BillboardModel[] }>();

  for (const bb of billboards) {
    const team = findOptimalTeamForRemoval(teams, bb.Size, bb.City, bb.friend_company_id);
    if (!team) continue;

    if (!result.has(team.id)) {
      result.set(team.id, {
        team,
        billboardIds: [],
        billboards: [],
      });
    }

    const group = result.get(team.id)!;
    group.billboardIds.push(bb.ID);
    group.billboards.push(bb);
  }

  return result;
}
