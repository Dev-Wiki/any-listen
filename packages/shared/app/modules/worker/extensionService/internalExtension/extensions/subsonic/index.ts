import type { ExtensionContext, ExtensionHostContext } from '../type'
import { listProviderActions } from './listProviderAction'
import { resourceActions } from './resourceAction'
import { initHostContext } from './shared'

export const pkg: AnyListen.Extension.Manifest = {
  id: 'internal.subsonic',
  name: 'Subsonic / Navidrome',
  version: '0.0.1',
  contributes: {
    settings: [
      {
        field: 'enabledCache',
        name: 't(exts.subsonic.cache.name)',
        description: 't(exts.subsonic.cache.description)',
        type: 'boolean',
        default: false,
      },
      {
        field: 'enabledDebugLog',
        name: 't(exts.subsonic.debugLog.name)',
        description: 't(exts.subsonic.debugLog.description)',
        type: 'boolean',
        default: false,
      },
      {
        field: 'servers',
        name: 't(exts.subsonic.servers.name)',
        description: 't(exts.subsonic.servers.description)',
        textarea: true,
        type: 'input',
        default: '',
      },
    ],
    listProviders: [
      {
        id: 'subsonic',
        name: 't(exts.subsonic.name)',
        description: 't(exts.subsonic.description)',
        fileSortable: false,
        form: [
          {
            field: 'url',
            name: 't(exts.subsonic.form.url.name)',
            description: 't(exts.subsonic.form.url.description)',
            type: 'input',
            default: '',
          },
          {
            field: 'username',
            name: 't(exts.subsonic.form.username.name)',
            description: 't(exts.subsonic.form.username.description)',
            type: 'input',
            default: '',
          },
          {
            field: 'listType',
            name: 't(exts.subsonic.form.listType.name)',
            description: 't(exts.subsonic.form.listType.description)',
            type: 'selection',
            default: 'album_newest',
            enum: [
              'album_newest',
              'album_random',
              'album_frequent',
              'album_recent',
              'album_starred',
              'random_songs',
              'starred_songs',
              'playlist',
            ],
            enumName: [
              't(exts.subsonic.form.listType.album_newest)',
              't(exts.subsonic.form.listType.album_random)',
              't(exts.subsonic.form.listType.album_frequent)',
              't(exts.subsonic.form.listType.album_recent)',
              't(exts.subsonic.form.listType.album_starred)',
              't(exts.subsonic.form.listType.random_songs)',
              't(exts.subsonic.form.listType.starred_songs)',
              't(exts.subsonic.form.listType.playlist)',
            ],
          },
          {
            field: 'maxBitRate',
            name: 't(exts.subsonic.form.maxBitRate.name)',
            description: 't(exts.subsonic.form.maxBitRate.description)',
            type: 'selection',
            default: '0',
            enum: ['0', '128', '192', '256', '320'],
            enumName: [
              't(exts.subsonic.form.maxBitRate.original)',
              't(exts.subsonic.form.maxBitRate.128kbps)',
              't(exts.subsonic.form.maxBitRate.192kbps)',
              't(exts.subsonic.form.maxBitRate.256kbps)',
              't(exts.subsonic.form.maxBitRate.320kbps)',
            ],
          },
          {
            field: 'format',
            name: 't(exts.subsonic.form.format.name)',
            description: 't(exts.subsonic.form.format.description)',
            type: 'selection',
            default: 'raw',
            enum: ['raw', 'mp3', 'ogg', 'aac'],
            enumName: [
              't(exts.subsonic.form.format.raw)',
              't(exts.subsonic.form.format.mp3)',
              't(exts.subsonic.form.format.ogg)',
              't(exts.subsonic.form.format.aac)',
            ],
          },
        ],
      },
    ],
    resource: [
      {
        id: 'subsonic',
        name: 't(exts.subsonic.name)',
        resource: ['musicUrl', 'musicPic', 'musicLyric'],
      },
    ],
  },
  main: '',
  publicKey: '',
}

type LPA = AnyListen.IPCExtension.ListProviderAction
type RS = AnyListen.IPCExtension.ResourceAction

export const setup = async (
  extension: AnyListen.Extension.Extension,
  hostContext: ExtensionHostContext
): Promise<ExtensionContext> => {
  initHostContext(hostContext)
  return {
    resourceAction: async <T extends keyof RS>(action: T, params: Parameters<RS[T]>[0]): Promise<Awaited<ReturnType<RS[T]>>> => {
      if (!(action in resourceActions)) throw new Error(`action ${String(action)} not found`)
      // @ts-expect-error
      return resourceActions[action](params) as Awaited<ReturnType<RS[T]>>
    },
    listProviderAction: async <T extends keyof LPA>(
      action: T,
      params: Parameters<LPA[T]>[0]
    ): Promise<Awaited<ReturnType<LPA[T]>>> => {
      if (!(action in listProviderActions)) throw new Error(`action ${String(action)} not found`)
      // @ts-expect-error
      return listProviderActions[action](params) as Awaited<ReturnType<LPA[T]>>
    },
  }
}
