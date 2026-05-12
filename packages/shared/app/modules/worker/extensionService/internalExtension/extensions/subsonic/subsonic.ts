import { sizeFormate } from '@any-listen/common/utils'
import { SubsonicClient, type Song } from '@any-listen/nodejs/subsonic-client'

import type { SubsonicServerConfig } from './utils'
import { debugLog, getEnabledCache, getSubsonicOptionsByListInfo, getSubsonicOptionsByMusicInfo } from './utils'
import { hostContext, logcat } from './shared'

export type { SubsonicClient, Song } from '@any-listen/nodejs/subsonic-client'
export type { SubsonicClientOptions } from '@any-listen/nodejs/subsonic-client'

export const createSubsonicClient = (options: SubsonicServerConfig) => {
  return new SubsonicClient({
    serverUrl: options.url,
    username: options.username,
    password: options.password,
    onError(err) {
      logcat.error('SubsonicClient', err)
    },
    async onDebugLog(logMessage) {
      await debugLog(logMessage)
    },
  })
}

export const buildSubsonicError = (err: Error) => {
  const msg = err.message
  if (msg.includes('40') && msg.includes('Unauthorized')) {
    return Error(hostContext.i18n.t('exts.subsonic.form.error.invalid_password'))
  }
  if (msg.includes('40') && msg.includes('not found')) {
    return Error(hostContext.i18n.t('exts.subsonic.form.error.server_not_found'))
  }
  return err
}

/** Test server connectivity */
export const testConnection = async (options: SubsonicServerConfig) => {
  const client = createSubsonicClient(options)
  const ok = await client.ping().catch(async () => false)
  if (!ok) {
    throw Error(hostContext.i18n.t('exts.subsonic.form.error.test_connection_failed'))
  }
}

/** Set password via input dialog */
export const setPassword = async (options: SubsonicServerConfig) => {
  const password = await hostContext.showInputBox({
    placeholder: hostContext.i18n.t('exts.subsonic.form.input.password_placeholder'),
    title: hostContext.i18n.t('exts.subsonic.form.input.password_title'),
    prompt: options.password
      ? hostContext.i18n.t('exts.subsonic.form.error.invalid_password_prompt')
      : hostContext.i18n.t('exts.subsonic.form.error.no_password_prompt'),
    async validateInput(value) {
      const client = createSubsonicClient({ ...options, password: value })
      return client
        .ping()
        .then((ok) => {
          if (!ok) {
            if (!value) return hostContext.i18n.t('exts.subsonic.form.error.no_password_prompt')
            return hostContext.i18n.t('exts.subsonic.form.error.invalid_password_prompt')
          }
          return null
        })
        .catch((err: Error) => {
          const msg = err.message
          if (msg.includes('40')) {
            if (!value) return hostContext.i18n.t('exts.subsonic.form.error.no_password_prompt')
            return hostContext.i18n.t('exts.subsonic.form.error.invalid_password_prompt')
          }
          return null
        })
    },
  })
  return password
}

export const getMusicUrl = async (options: SubsonicServerConfig, songId: string, maxBitRate?: number, format?: string) => {
  const client = createSubsonicClient(options)
  const [url, reqOpts] = client.getStreamRequestOptions(songId, maxBitRate, format)
  return hostContext.createProxyUrl(url, reqOpts, await getEnabledCache()).catch((err: Error) => {
    logcat.error('Subsonic getMusicUrl error', err)
    throw buildSubsonicError(err)
  })
}

export const getCoverArtUrl = (options: SubsonicServerConfig, coverArtId: string, size?: number): string => {
  const client = createSubsonicClient(options)
  return client.getResourceUrl('getCoverArt', { id: coverArtId, size })
}

/** Build MusicInfoOnline from Subsonic Song */
export const songToMusicInfo = (
  song: Song,
  source: string,
  extId: string,
  serverUrl: string,
  username: string
): AnyListen.Music.MusicInfoOnline => {
  const id = `${extId}_${source}_${username}_${serverUrl}_${song.id}`
  return {
    id,
    name: song.title,
    singer: song.artist || '',
    isLocal: false,
    interval: song.duration ? String(song.duration) : null,
    meta: {
      unparsed: false,
      createTime: 0,
      musicId: id,
      albumName: song.album || '',
      posTime: 0,
      source,
      fileName: `${song.title}.${song.suffix || 'mp3'}`,
      size: song.size || 0,
      sizeStr: sizeFormate(song.size || 0),
      updateTime: 0,
      url: serverUrl,
      username,
      songId: song.id,
      coverArtId: song.coverArt,
      bitrateLabel: song.bitRate ? `${Math.round(song.bitRate / 1000)}kbps` : '',
      year: song.year || 0,
      suffix: song.suffix,
    },
  }
}

/**
 * Get the list of songs based on list type.
 * Returns both the song list and a flag indicating if metadata is already complete.
 */
export const getListSongs = async (
  client: SubsonicClient,
  listType: string,
  playlistId?: string,
  size?: number
): Promise<{ songs: Song[]; metadataComplete: boolean }> => {
  switch (listType) {
    case 'random_songs':
      return {
        songs: await client.getRandomSongs(size || 500),
        metadataComplete: true,
      }

    case 'starred_songs':
      return {
        songs: (await client.getStarred2()).song || [],
        metadataComplete: true,
      }

    case 'playlist': {
      if (!playlistId) {
        // If no playlist selected, return all playlists as "song-less" entries
        // for browsing. Actual songs are fetched when a playlist is selected.
        return { songs: [], metadataComplete: true }
      }
      const playlist = await client.getPlaylist(playlistId)
      return { songs: playlist.entry, metadataComplete: true }
    }

    case 'album_newest':
    case 'album_random':
    case 'album_frequent':
    case 'album_recent':
    case 'album_starred':
    case 'alphabeticalByName':
    case 'alphabeticalByArtist': {
      // Map listType to getAlbumList2 type
      const typeMap: Record<string, string> = {
        album_newest: 'newest',
        album_random: 'random',
        album_frequent: 'frequent',
        album_recent: 'recent',
        album_starred: 'starred',
      }
      const albumType = typeMap[listType] || 'newest'
      const albums = await client.getAlbumList2(albumType, 100, 0)
      // Fetch songs for each album
      const allSongs: Song[] = []
      for (const album of albums) {
        try {
          const detail = await client.getAlbum(album.id)
          allSongs.push(...detail.song)
        } catch {
          // Skip albums that fail to load
        }
      }
      return { songs: allSongs, metadataComplete: true }
    }

    default:
      return { songs: await client.getRandomSongs(size || 500), metadataComplete: true }
  }
}
