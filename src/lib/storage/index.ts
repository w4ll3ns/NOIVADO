import 'server-only'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { env } from '@/lib/env'

export type StoredObject = { body: ReadableStream<Uint8Array>; size?: number; contentType?: string }

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>
  getStream(key: string): Promise<StoredObject | null>
  getBuffer(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,300}$/

function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes('..')) throw new Error(`Chave de armazenamento inválida: ${key}`)
}

class LocalStorage implements Storage {
  constructor(private base: string) {}
  private file(key: string) {
    assertKey(key)
    return path.join(this.base, key)
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key)
    await mkdir(path.dirname(f), { recursive: true })
    await writeFile(f, data)
  }
  async getStream(key: string): Promise<StoredObject | null> {
    const f = this.file(key)
    try {
      const s = await stat(f)
      const body = Readable.toWeb(createReadStream(f)) as ReadableStream<Uint8Array>
      return { body, size: s.size }
    } catch {
      return null
    }
  }
  async getBuffer(key: string) {
    try {
      return await readFile(this.file(key))
    } catch {
      return null
    }
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true })
  }
}

class S3Storage implements Storage {
  private clientPromise: Promise<{ client: import('@aws-sdk/client-s3').S3Client; mod: typeof import('@aws-sdk/client-s3') }>
  private bucket: string
  constructor() {
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw new Error('S3_BUCKET não configurado')
    this.bucket = bucket
    this.clientPromise = import('@aws-sdk/client-s3').then((mod) => ({
      mod,
      client: new mod.S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
            : undefined,
      }),
    }))
  }
  async put(key: string, data: Buffer, contentType: string) {
    assertKey(key)
    const { client, mod } = await this.clientPromise
    await client.send(new mod.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }))
  }
  async getStream(key: string): Promise<StoredObject | null> {
    assertKey(key)
    const { client, mod } = await this.clientPromise
    try {
      const res = await client.send(new mod.GetObjectCommand({ Bucket: this.bucket, Key: key }))
      if (!res.Body) return null
      return {
        body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        size: res.ContentLength,
        contentType: res.ContentType,
      }
    } catch {
      return null
    }
  }
  async getBuffer(key: string) {
    const obj = await this.getStream(key)
    if (!obj) return null
    return Buffer.from(await new Response(obj.body).arrayBuffer())
  }
  async delete(key: string) {
    assertKey(key)
    const { client, mod } = await this.clientPromise
    await client.send(new mod.DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

let instance: Storage | null = null

export function storage(): Storage {
  if (!instance) {
    instance = env.storageDriver === 's3' ? new S3Storage() : new LocalStorage(path.resolve(env.storageLocalDir))
  }
  return instance
}
