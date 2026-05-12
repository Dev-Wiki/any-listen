import { parseLyrics } from '@any-listen/nodejs/lrcTool'

import { getSubsonicOptionsByMusicInfo } from './utils'
import { getCoverArtUrl, getMusicUrl } from './subsonic'

export const resourceActions: Partial<AnyListen.IPCExtension.ResourceAction> = {
  async musicUrl({ musicInfo }) {
    const options = await getSubsonicOptionsByMusicInfo(musicInfo)
    const songId = musicInfo.meta.songId as string
    if (!songId) throw new Error('no songId in musicInfo.meta')
    const maxBitRate = (musicInfo.meta.maxBitRate as number) || 0
    const format = (musicInfo.meta.format as string) || 'raw'
    const url = await getMusicUrl(options, songId, maxBitRate, format !== 'raw' ? format : undefined)
    return {
      quality: musicInfo.meta.bitrateLabel || '',
      url,
    }
  },

  async musicPic({ musicInfo }) {
    const options = await getSubsonicOptionsByMusicInfo(musicInfo)
    const coverArtId = musicInfo.meta.coverArtId as string
    if (!coverArtId) throw new Error('no coverArt')
    return getCoverArtUrl(options, coverArtId, 600)
  },

  async musicLyric({ musicInfo }) {
    const { createSubsonicClient } = await import('./subsonic')
    const options = await getSubsonicOptionsByMusicInfo(musicInfo)
    const client = createSubsonicClient(options)
    const lyric = await client.getLyrics(musicInfo.singer, musicInfo.name)
    if (!lyric) throw new Error('no lyric')
    return {
      name: musicInfo.name,
      singer: musicInfo.singer,
      interval: musicInfo.interval,
      ...parseLyrics(lyric),
    }
  },
}
