import { generateId, isUrl } from '@any-listen/common/utils'

import { hostContext, logcat } from './shared'

export interface SubsonicServerConfig {
  url: string
  username: string
  password: string
}

const getServers = async (): Promise<SubsonicServerConfig[]> => {
  const config = (await hostContext.getConfigs<[string]>(['servers']))[0] || ''
  const randomStr = generateId()
  return config
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      line = line.trim()
      line = line.replaceAll('\\,', randomStr)
      const [_url = '', _username = '', _password = ''] = line.split(',').map((part) => part.replaceAll(randomStr, ',').trim())
      if (_url.endsWith('/')) {
        return { url: _url.slice(0, -1), username: _username, password: _password }
      }
      return { url: _url, username: _username, password: _password }
    })
}

const saveServers = async (servers: SubsonicServerConfig[]) => {
  const config = servers
    .map((server) => {
      const url = server.url.replaceAll(',', '\\,')
      const username = server.username.replaceAll(',', '\\,')
      const password = server.password.replaceAll(',', '\\,')
      return `${url}, ${username}${password ? `, ${password}` : ''}`
    })
    .join('\n')
  await hostContext.setConfigs({ servers: config })
}

const getPassword = async (url: string, username: string) => {
  const servers = await getServers()
  return servers.find((server) => server.url === url && server.username === username)?.password || ''
}

export const getEnabledCache = async () => {
  return ((await hostContext.getConfigs<[boolean]>(['enabledCache']))[0]) == true
}

export const getEnabledDebugLog = async () => {
  return ((await hostContext.getConfigs<[boolean]>(['enabledDebugLog']))[0]) == true
}

export const savePassword = async (url: string, username: string, password: string) => {
  const servers = await getServers()
  const server = servers.find((server) => server.url === url && server.username === username)
  if (server) {
    server.password = password
  } else {
    servers.push({ url, username, password })
  }
  await saveServers(servers)
  void hostContext.showMessage(hostContext.i18n.t('exts.subsonic.form.message.save_password_success'))
}

export const verifyForm = async (
  formData: AnyListen.List.UserListInfoByRemoteMeta | AnyListen.Music.MusicInfoOnline['meta']
): Promise<SubsonicServerConfig> => {
  if (typeof formData.url !== 'string' || !isUrl(formData.url)) {
    throw new Error(hostContext.i18n.t('exts.subsonic.form.error.invalid_url'))
  }
  return {
    url: (formData.url as string).replace(/\/$/, ''),
    username: (formData.username as string) || '',
    password: (formData.password as string) || '',
  }
}

export const getSubsonicOptionsByListInfo = async (
  listInfo: AnyListen.List.UserListInfoByRemoteMeta
): Promise<SubsonicServerConfig & { listType: string; playlistId?: string }> => {
  const options = await verifyForm(listInfo)
  options.password = await getPassword(options.url, options.username)
  return {
    ...options,
    listType: (listInfo.listType as string) || 'album_newest',
    playlistId: (listInfo.playlistId as string) || undefined,
  }
}

export const getSubsonicOptionsByMusicInfo = async (musicInfo: AnyListen.Music.MusicInfoOnline) => {
  const options = await verifyForm(musicInfo.meta)
  options.password = await getPassword(options.url, options.username)
  return options
}

export const debugLog = async (logMessage: string) => {
  try {
    if (!(await getEnabledDebugLog())) return
    logcat.debug('SubsonicClient', logMessage)
  } catch {
    /* ignore */
  }
}
