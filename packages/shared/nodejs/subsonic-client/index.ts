import crypto from 'node:crypto'

import { request, type Options, type Response } from '../request'
import type {
  AlbumID3,
  AlbumWithSongsID3,
  ArtistID3,
  ArtistInfo2,
  ArtistWithAlbumsID3,
  ArtistsID3,
  Genre,
  Playlist,
  PlaylistWithSongs,
  SearchResult3,
  Song,
  Starred2,
  SubsonicClientOptions,
  SubsonicParams,
  SubsonicResponse,
} from './types'

export type {
  AlbumID3,
  AlbumWithSongsID3,
  ArtistID3,
  ArtistInfo2,
  ArtistWithAlbumsID3,
  ArtistsID3,
  Genre,
  Playlist,
  PlaylistWithSongs,
  SearchResult3,
  Song,
  Starred2,
  SubsonicClientOptions,
} from './types'

const API_VERSION = '1.16.1'
const CLIENT_NAME = 'AnyListen'

const generateSalt = (length = 12): string => {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}

const buildToken = (password: string, salt: string): string => {
  return crypto.createHash('md5').update(password + salt).digest('hex')
}

export class SubsonicClient {
  private readonly options: SubsonicClientOptions
  private readonly serverUrl: string

  constructor(options: SubsonicClientOptions) {
    this.options = options
    this.serverUrl = options.serverUrl.replace(/\/$/, '')
  }

  private debugLog(msg: string) {
    try {
      this.options.onDebugLog?.(msg)
    } catch {
      /* ignore */
    }
  }

  private handleError(msg: string, err?: Error) {
    const errorMsg = err ? `${msg}: ${err.message}` : msg
    try {
      this.options.onError?.(errorMsg)
    } catch {
      /* ignore */
    }
    return new Error(errorMsg)
  }

  private buildAuthParams(): Record<string, string> {
    const salt = generateSalt()
    return {
      u: this.options.username,
      t: buildToken(this.options.password, salt),
      s: salt,
      v: API_VERSION,
      c: CLIENT_NAME,
      f: 'json',
    }
  }

  /**
   * Make a request to the Subsonic REST API
   */
  private async apiRequest<T>(
    endpoint: string,
    params: SubsonicParams = {},
    requestOpts?: Partial<Options>
  ): Promise<T> {
    const allParams = { ...this.buildAuthParams(), ...params }
    const query = Object.fromEntries(
      Object.entries(allParams).filter(([, v]) => v !== undefined)
    ) as Record<string, string>

    const url = `${this.serverUrl}/rest/${endpoint}`

    this.debugLog(`request: [${url}] ${JSON.stringify(params)}`)

    const res: Response<SubsonicResponse<T>> = await request(url, {
      method: 'GET',
      query,
      ...requestOpts,
    }).catch((err: Error) => {
      this.debugLog(`request error: [${url}] ${err.message}`)
      throw this.handleError(`Subsonic request failed: ${endpoint}`, err)
    })

    const body = (res as Response<SubsonicResponse<T>>).body
    if (!body || !body['subsonic-response']) {
      throw this.handleError(`Invalid response from ${endpoint}`)
    }

    const resp = body['subsonic-response']
    if (resp.status === 'failed') {
      const errorMsg = resp.error ? `[${resp.error.code}] ${resp.error.message}` : 'Unknown error'
      throw this.handleError(`Subsonic API error: ${endpoint} - ${errorMsg}`)
    }

    return resp as unknown as T
  }

  /**
   * Build resource URLs (stream, coverArt) that need auth params inline.
   * These URLs don't go through apiRequest - they're passed to the proxy system.
   */
  getResourceUrl(endpoint: string, params: SubsonicParams = {}): string {
    const allParams = { ...this.buildAuthParams(), ...params }
    const query = Object.entries(allParams)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    return `${this.serverUrl}/rest/${endpoint}?${query}`
  }

  /**
   * Get stream URL with optional request options for proxy
   */
  getStreamRequestOptions(id: string, maxBitRate?: number, format?: string): [string, Options] {
    const params: SubsonicParams = { id }
    if (maxBitRate && maxBitRate > 0) params.maxBitRate = maxBitRate
    if (format && format !== 'raw') params.format = format
    const url = this.getResourceUrl('stream', params)
    return [url, { method: 'GET' }]
  }

  // ==================== Browsing ====================

  /** Get all artists, indexed alphabetically */
  async getArtists(): Promise<ArtistsID3> {
    const resp = await this.apiRequest<{ artists: ArtistsID3 }>('getArtists')
    return resp.artists
  }

  /** Get a single artist with album list */
  async getArtist(id: string): Promise<ArtistWithAlbumsID3> {
    const resp = await this.apiRequest<{ artist: ArtistWithAlbumsID3 }>('getArtist', { id })
    return resp.artist
  }

  /** Get artist info (bio, similar artists, etc.) */
  async getArtistInfo2(id: string, count?: number): Promise<ArtistInfo2> {
    const resp = await this.apiRequest<{ artistInfo2: ArtistInfo2 }>('getArtistInfo2', { id, count })
    return resp.artistInfo2
  }

  /** Get album with song list */
  async getAlbum(id: string): Promise<AlbumWithSongsID3> {
    const resp = await this.apiRequest<{ album: AlbumWithSongsID3 }>('getAlbum', { id })
    return resp.album
  }

  /**
   * Get album list by type.
   * Types: newest, random, highest, frequent, recent, starred,
   *        alphabeticalByName, alphabeticalByArtist, byYear, byGenre
   */
  async getAlbumList2(
    type: string,
    size?: number,
    offset?: number,
    fromYear?: number,
    toYear?: number,
    genre?: string
  ): Promise<AlbumID3[]> {
    const resp = await this.apiRequest<{ albumList2: { album: AlbumID3[] } }>('getAlbumList2', {
      type,
      size,
      offset,
      fromYear,
      toYear,
      genre,
    })
    return resp.albumList2.album
  }

  // ==================== Songs ====================

  /** Get random songs */
  async getRandomSongs(size?: number, genre?: string, fromYear?: number, toYear?: number): Promise<Song[]> {
    const resp = await this.apiRequest<{ randomSongs: { song: Song[] } }>('getRandomSongs', {
      size,
      genre,
      fromYear,
      toYear,
    })
    return resp.randomSongs.song
  }

  /** Get songs by genre */
  async getSongsByGenre(genre: string, count?: number, offset?: number): Promise<Song[]> {
    const resp = await this.apiRequest<{ songsByGenre: { song: Song[] } }>('getSongsByGenre', {
      genre,
      count,
      offset,
    })
    return resp.songsByGenre.song
  }

  /** Get starred items */
  async getStarred2(): Promise<Starred2> {
    const resp = await this.apiRequest<{ starred2: Starred2 }>('getStarred2')
    return resp.starred2
  }

  /** Get song details */
  async getSong(id: string): Promise<Song> {
    const resp = await this.apiRequest<{ song: Song }>('getSong', { id })
    return resp.song
  }

  // ==================== Genres ====================

  /** Get all genres */
  async getGenres(): Promise<Genre[]> {
    const resp = await this.apiRequest<{ genres: { genre: Genre[] } }>('getGenres')
    return resp.genres.genre
  }

  // ==================== Search ====================

  /** Search for artists, albums, and songs */
  async search3(
    query: string,
    artistCount?: number,
    albumCount?: number,
    songCount?: number
  ): Promise<SearchResult3> {
    const resp = await this.apiRequest<{ searchResult3: SearchResult3 }>('search3', {
      query,
      artistCount,
      albumCount,
      songCount,
    })
    return resp.searchResult3
  }

  // ==================== Playlists ====================

  /** Get all playlists */
  async getPlaylists(username?: string): Promise<Playlist[]> {
    const resp = await this.apiRequest<{ playlists: { playlist: Playlist[] } }>('getPlaylists', { username })
    const list = resp.playlists.playlist
    return Array.isArray(list) ? list : list ? [list] : []
  }

  /** Get playlist with songs */
  async getPlaylist(id: string): Promise<PlaylistWithSongs> {
    const resp = await this.apiRequest<{ playlist: PlaylistWithSongs }>('getPlaylist', { id })
    return resp.playlist
  }

  // ==================== Media Annotation (star/rate) ====================

  /** Star an item */
  async star(id?: string, albumId?: string, artistId?: string): Promise<void> {
    await this.apiRequest('star', { id, albumId, artistId })
  }

  /** Unstar an item */
  async unstar(id?: string, albumId?: string, artistId?: string): Promise<void> {
    await this.apiRequest('unstar', { id, albumId, artistId })
  }

  /** Set rating (1-5) */
  async setRating(id: string, rating: number): Promise<void> {
    await this.apiRequest('setRating', { id, rating })
  }

  /** Scrobble submission */
  async scrobble(id: string, time?: number, submission?: boolean): Promise<void> {
    await this.apiRequest('scrobble', { id, time, submission })
  }

  // ==================== Lyrics ====================

  /** Get lyrics for a song. Returns structured lyrics if server supports OpenSubsonic, or plain text. */
  async getLyrics(artist?: string, title?: string): Promise<string | null> {
    if (!artist && !title) return null
    try {
      const resp = await this.apiRequest<{ lyrics: { value?: string; line?: Array<{ start: number; value: string }> } }>(
        'getLyrics', { artist, title }
      )
      return resp.lyrics?.value || null
    } catch {
      return null
    }
  }

  // ==================== Utility ====================

  /** Ping the server to test connectivity */
  async ping(): Promise<boolean> {
    try {
      const resp = await this.apiRequest<{}>('ping')
      return !!resp
    } catch {
      return false
    }
  }
}