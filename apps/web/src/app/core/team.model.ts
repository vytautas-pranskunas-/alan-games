export type TeamId = 'dragon' | 'toxic';

export interface TeamMeta {
  id: TeamId;
  name: string;
  wordmark: string;
  logoSrc: string;
  tagline: string;
}

export const TEAMS: Record<TeamId, TeamMeta> = {
  dragon: {
    id: 'dragon',
    name: 'Dragon Play',
    wordmark: 'DRAGON PLAY',
    logoSrc: '/logos/dragon-play.png',
    tagline: 'Synthwave arcade energy',
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic Zone',
    wordmark: 'TOXIC ZONE',
    logoSrc: '/logos/toxic-zone.png',
    tagline: 'Neon indie game lab',
  },
};

export function teamMeta(id: TeamId): TeamMeta {
  return TEAMS[id];
}
