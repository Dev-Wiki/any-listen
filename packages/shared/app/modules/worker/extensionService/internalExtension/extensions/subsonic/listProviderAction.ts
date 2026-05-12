import { createCache } from '@any-listen/common/cache'

import { hostContext, logcat } from './shared'
import {
  buildSubsonicError,
  createSubsonicClient,
  songToMusicInfo,
  testConnection,
  getListSongs,
  type Song,
} from './subsonic'
import { debugLog, getSubsonicOptionsByListInfo, type SubsonicServerConfig } from './utils'

interface SubsonicSongStore {
  songs: Map<string, Song>
}

const listCache = createCache<SubsonicSongStore>({ ttl: 10 * 60 * 1000 })
const songCache = createCache<AnyListen.Music.MusicInfoOnline>({ max: 5000, ttl: 30 * 60 * 1000 })

const getSongStore = async (
  options: SubsonicServerConfig & { listType: string; playlistId?: string },
  extId: string,
  source: string,
  listId: string
): Promise<SubsonicSongStore> => {
  if (listCache.has(listId)) return listCache.get(listId)!

  await debugLog(`fetching songs for list: ${listId}, type: ${options.listType}`)
  const client = createSubsonicClient(options)

  const { songs } = await getListSongs(client, options.listType, options.playlistId).catch((err: Error) => {
    logcat.error('Subsonic list error', err)
    throw buildSubsonicError(err)
  })

  const store: SubsonicSongStore = { songs: new Map() }
  for (const song of songs) {
    const musicInfo = songToMusicInfo(song, source, extId, options.url, options.username)
    store.songs.set(musicInfo.id, song)
    songCache.set(musicInfo.id, musicInfo)
  }

  listCache.set(listId, store)
  return store
}

export const listProviderActions: AnyListen.IPCExtension.ListProviderAction = {
  async createList(params) {
    void debugLog(`createList: ${JSON.stringify(params)}`)
    await testConnection(await getSubsonicOptionsByListInfo(params.data.meta))
  },

  async deleteList() {
    // No server-side cleanup needed for Subsonic lists
  },

  async updateList(params) {
    void debugLog(`updateList: ${JSON.stringify(params)}`)
    const options = await getSubsonicOptionsByListInfo(params.data.meta)
    await testConnection(options)
    // Invalidate cache so next getListMusicIds fetches fresh data
    listCache.delete(params.data.id)
  },

  async sortListMusics({ data }) {
    void debugLog('sortListMusics')
    const options = await getSubsonicOptionsByListInfo(data.list.meta)
    const store = await getSongStore(options, data.extensionId, data.source, data.list.id)

    const idMap = new Set(data.musics.map((m) => m.id))
    const availableIds = Array.from(store.songs.keys())

    // For Subsonic, sorting is done server-side.
    // Return available IDs in the order they were served, keeping only those in the current music list.
    return availableIds.filter((id) => idMap.has(id))
  },

  async removeListMusics() {
    // Subsonic doesn't support deleting server files.
    // For playlist-based lists, we could call unstar, but that requires careful handling.
    throw new Error(hostContext.i18n.t('exts.subsonic.list_provider.remove_not_supported'))
  },

  async getListMusicIds({ extensionId, data }) {
    const options = await getSubsonicOptionsByListInfo(data.meta)
    const store = await getSongStore(options, extensionId, data.source, data.id)
    return Array.from(store.songs.keys())
  },

  async getMusicInfoByIds({ data }) {
    void debugLog(`getMusicInfoByIds: ${JSON.stringify(data)}`)

    // Ensure the song store is populated first
    const options = await getSubsonicOptionsByListInfo(data.list.meta)
    await getSongStore(options, data.extensionId, data.source, data.list.id)

    const musics: AnyListen.Music.MusicInfoOnline[] = []
    for (const id of data.ids) {
      const cached = songCache.get(id)
      if (cached) musics.push(cached)
    }

    return { musics }
  },

  async parseMusicInfoMetadata({ data: musicInfo }) {
    // Subsonic songs come with complete metadata from the API.
    // No additional parsing needed - just mark as parsed.
    return {
      ...musicInfo,
      meta: {
        ...musicInfo.meta,
        unparsed: false,
      },
    }
  },
}