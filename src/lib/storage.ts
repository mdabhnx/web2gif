import fs from 'fs'
import path from 'path'

export async function uploadGif(gifPath: string, jobId: string): Promise<string> {
  const driver = process.env.STORAGE_DRIVER ?? 'local'

  if (driver === 's3') {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
    const fileBuffer = fs.readFileSync(gifPath)
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `${jobId}.gif`,
        Body: fileBuffer,
        ContentType: 'image/gif',
      })
    )
    return `${process.env.S3_PUBLIC_URL}/${jobId}.gif`
  }

  // local storage
  const outputDir = path.join(process.cwd(), 'public', 'outputs')
  fs.mkdirSync(outputDir, { recursive: true })
  const dest = path.join(outputDir, `${jobId}.gif`)
  fs.copyFileSync(gifPath, dest)
  return `/outputs/${jobId}.gif`
}
