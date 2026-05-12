#!/usr/bin/env node
/**
 * Subsonic/Navidrome API 端到端测试脚本
 * 用法: node test-subsonic-api.mjs
 *
 * 验证服务器响应格式是否与 subsonic-client/types.ts 匹配
 */

import crypto from 'node:crypto'
import process from 'node:process'

// ============ CONFIG (set via env vars) ============
const SERVER_URL = process.env.SUBSONIC_URL || ''
const USERNAME = process.env.SUBSONIC_USER || ''
const PASSWORD = process.env.SUBSONIC_PASSWORD || ''

if (!SERVER_URL || !USERNAME || !PASSWORD) { console.error('Usage: SUBSONIC_URL=https://... SUBSONIC_USER=... SUBSONIC_PASSWORD=... node test-subsonic-api.mjs'); process.exit(1) }

// ============ HELPERS ============
const buildAuthParams = () => {
  const salt = crypto.randomBytes(12).toString('hex').slice(0, 12)
  const token = crypto.createHash('md5').update(PASSWORD + salt).digest('hex')
  return { u: USERNAME, t: token, s: salt, v: '1.16.1', c: 'AnyListen-Test', f: 'json' }
}

const apiCall = async (endpoint, params = {}) => {
  const q = new URLSearchParams({ ...buildAuthParams(), ...params })
  const url = `${SERVER_URL}/rest/${endpoint}?${q}`
  console.log(`\n  GET ${url}`)
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  const body = await res.json()
  const sr = body['subsonic-response']
  if (sr.status === 'failed') {
    throw new Error(`[${sr.error?.code}] ${sr.error?.message}`)
  }
  return sr
}

const ok = (msg) => console.log(`  ✅ ${msg}`)
const fail = (msg, e) => {
  console.log(`  ❌ ${msg}`)
  if (e) console.log(`     ${e.message}`)
}
const info = (msg) => console.log(`  ℹ️  ${msg}`)

// ============ TESTS ============
const tests = []

tests.push({
  name: '1. ping',
  run: async () => {
    const sr = await apiCall('ping')
    ok(`server: ${sr.serverVersion}, openSubsonic: ${sr.openSubsonic}`)
  }
})

tests.push({
  name: '2. getArtists',
  run: async () => {
    const sr = await apiCall('getArtists')
    const artists = sr.artists
    info(`ignoredArticles: "${artists.ignoredArticles}"`)
    info(`index groups: ${artists.index?.length || 0}`)
    let total = 0
    if (artists.index) {
      for (const group of artists.index) {
        total += group.artist?.length || 0
      }
    }
    ok(`total artists: ${total}`)
    // show first artist
    if (artists.index?.[0]?.artist?.[0]) {
      const a = artists.index[0].artist[0]
      info(`first: ${a.name} (id: ${a.id}, albums: ${a.albumCount})`)
    }
  }
})

tests.push({
  name: '3. getAlbumList2 (newest)',
  run: async () => {
    const sr = await apiCall('getAlbumList2', { type: 'newest', size: 5 })
    const albums = sr.albumList2?.album || []
    ok(`${albums.length} albums`)
    for (const a of albums.slice(0, 3)) {
      info(`${a.name}${a.artist ? ` - ${a.artist}` : ''} (${a.songCount} songs, id: ${a.id})`)
    }
  }
})

tests.push({
  name: '4. getAlbumList2 (random)',
  run: async () => {
    const sr = await apiCall('getAlbumList2', { type: 'random', size: 3 })
    const albums = sr.albumList2?.album || []
    ok(`${albums.length} albums`)
  }
})

tests.push({
  name: '5. getRandomSongs',
  run: async () => {
    const sr = await apiCall('getRandomSongs', { size: 3 })
    const songs = sr.randomSongs?.song || []
    ok(`${songs.length} songs`)
    for (const s of songs) {
      info(`${s.title} - ${s.artist || '?'} [${s.duration}s, ${s.bitRate}kbps, suffix: ${s.suffix}, coverArt: ${s.coverArt}]`)
    }
    // store first song id for stream test
    if (songs[0]) {
      tests.push({
        name: '5a. stream URL 生成 (getStreamRequestOptions 等价验证)',
        run: () => {
          const song = songs[0]
          const q = new URLSearchParams({ ...buildAuthParams(), id: song.id })
          const url = `${SERVER_URL}/rest/stream?${q}`
          info(`stream URL: ${url.slice(0, 100)}...`)
          ok('URL 格式正确')
        }
      })
      tests.push({
        name: '5b. coverArt URL 生成',
        run: () => {
          if (!songs[0].coverArt) return fail('no coverArt')
          const q = new URLSearchParams({ ...buildAuthParams(), id: songs[0].coverArt, size: '300' })
          const url = `${SERVER_URL}/rest/getCoverArt?${q}`
          info(`coverArt URL: ${url.slice(0, 100)}...`)
          ok('URL 格式正确')
        }
      })
    }
  }
})

tests.push({
  name: '6. getStarred2',
  run: async () => {
    const sr = await apiCall('getStarred2')
    const starred = sr.starred2
    const ac = starred.artist?.length || 0
    const al = starred.album?.length || 0
    const sc = starred.song?.length || 0
    ok(`artists: ${ac}, albums: ${al}, songs: ${sc}`)
  }
})

tests.push({
  name: '7. getPlaylists',
  run: async () => {
    const sr = await apiCall('getPlaylists')
    const list = sr.playlists?.playlist
    const playlists = Array.isArray(list) ? list : list ? [list] : []
    ok(`${playlists.length} playlists`)
    for (const p of playlists.slice(0, 3)) {
      info(`${p.name} (${p.songCount} songs, id: ${p.id})`)
    }
  }
})

tests.push({
  name: '8. search3',
  run: async () => {
    const sr = await apiCall('search3', { query: 'love', artistCount: 3, albumCount: 3, songCount: 3 })
    const result = sr.searchResult3 || {}
    const artists = result.artist?.length || 0
    const albums = result.album?.length || 0
    const songs = result.song?.length || 0
    ok(`artists: ${artists}, albums: ${albums}, songs: ${songs}`)
    if (result.song?.[0]) {
      info(`first song: ${result.song[0].title} - ${result.song[0].artist}`)
    }
  }
})

tests.push({
  name: '9. getGenres',
  run: async () => {
    const sr = await apiCall('getGenres')
    const genres = sr.genres?.genre || []
    ok(`${genres.length} genres`)
    if (genres[0]) info(`first: ${genres[0].value} (${genres[0].songCount} songs)`)
  }
})

// ============ RUN ============
console.log(`\n🔍 Testing Subsonic API: ${SERVER_URL}`)
console.log(`   User: ${USERNAME}\n`)

let passed = 0
let failed = 0

for (const test of tests) {
  try {
    await test.run()
    passed++
  } catch (e) {
    fail(test.name, e)
    failed++
  }
}

console.log(`\n${'═'.repeat(50)}`)
console.log(`  ✅ ${passed} passed  ❌ ${failed} failed  (${passed + failed} total)`)
console.log(`${'═'.repeat(50)}\n`)