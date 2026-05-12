// Subsonic API response types
// Reference: http://www.subsonic.org/pages/api.jsp
// Navidrome docs: https://www.navidrome.org/docs/developers/subsonic-api/

// ---- Response wrapper ----
export interface SubsonicResponse<T = Record<string, unknown>> {
  'subsonic-response': {
    status: 'ok' | 'failed'
    version: string
    type: string
    serverVersion: string
    openSubsonic?: boolean
    error?: { code: number; message: string }
  } & T
}

// ---- Common ----
export interface ArtistID3 {
  id: string
  name: string
  coverArt?: string
  albumCount: number
  artistImageUrl?: string
  starred?: string // ISO date
  userRating?: number
}

export interface ArtistInfo2 {
  id: string
  name: string
  coverArt?: string
  albumCount: number
  artistImageUrl?: string
  starred?: string
  userRating?: number
  similarArtist?: ArtistID3[]
}

export interface ArtistWithAlbumsID3 {
  id: string
  name: string
  coverArt?: string
  albumCount: number
  artistImageUrl?: string
  starred?: string
  userRating?: number
  album: AlbumID3[]
}

export interface AlbumID3 {
  id: string
  name: string
  artist?: string
  artistId?: string
  coverArt?: string
  songCount: number
  duration: number
  playCount?: number
  created: string // ISO date
  starred?: string
  year?: number
  genre?: string
}

export interface AlbumWithSongsID3 {
  id: string
  name: string
  artist?: string
  artistId?: string
  coverArt?: string
  songCount: number
  duration: number
  playCount?: number
  created: string
  starred?: string
  year?: number
  genre?: string
  song: Song[]
}

export interface Song {
  id: string
  parent?: string
  isDir: boolean
  title: string
  album?: string
  artist?: string
  track?: number
  year?: number
  genre?: string
  coverArt?: string
  size?: number
  contentType?: string
  suffix?: string
  transcodedContentType?: string
  transcodedSuffix?: string
  duration?: number
  bitRate?: number
  path?: string
  playCount?: number
  discNumber?: number
  created?: string
  starred?: string
  albumId?: string
  artistId?: string
  type?: string
  userRating?: number
}

export interface Playlist {
  id: string
  name: string
  comment?: string
  owner?: string
  public?: boolean
  songCount: number
  duration: number
  created: string
  changed: string
  coverArt?: string
}

export interface PlaylistWithSongs {
  id: string
  name: string
  comment?: string
  owner?: string
  public?: boolean
  songCount: number
  duration: number
  created: string
  changed: string
  coverArt?: string
  entry: Song[]
}

export interface SearchResult3 {
  artist?: ArtistID3[]
  album?: AlbumID3[]
  song?: Song[]
}

export interface Starred2 {
  artist?: ArtistID3[]
  album?: AlbumID3[]
  song?: Song[]
}

export interface Genre {
  songCount: number
  albumCount: number
  value: string
}

export interface IndexID3 {
  name: string
  artist: ArtistID3[]
}

export interface ArtistsID3 {
  index: IndexID3[]
  lastModified?: number
  ignoredArticles: string
}

// ---- SubsonicClient options ----
export interface SubsonicClientOptions {
  serverUrl: string
  username: string
  password: string
  onDebugLog?: (msg: string) => void
  onError?: (msg: string) => void
}

// ---- Internal request params ----
export type SubsonicParams = Record<string, string | number | undefined>
