import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { which } from './utils'

const execFileAsync = promisify(execFile)

export async function encodeGif(
  framePaths: string[],
  options: { width: number; fps: number; quality: number },
  tempDir: string
): Promise<string> {
  const outputPath = path.join(tempDir, 'output.gif')
  const finalPath = path.join(tempDir, 'final.gif')

  const gifskiPath = await which('gifski')

  if (gifskiPath) {
    // Primary: gifski
    await execFileAsync(gifskiPath, [
      '--fps', String(options.fps),
      '--quality', String(options.quality),
      '--width', String(options.width),
      '-o', outputPath,
      ...framePaths,
    ])
  } else {
    // Fallback: ffmpeg two-pass
    const ffmpeg = 'ffmpeg'
    const palettePath = path.join(tempDir, 'palette.png')
    const framePattern = path.join(tempDir, 'frame-%04d.png')

    await execFileAsync(ffmpeg, [
      '-i', framePattern,
      '-vf', `fps=${options.fps},scale=${options.width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
      palettePath,
    ])

    await execFileAsync(ffmpeg, [
      '-i', framePattern,
      '-i', palettePath,
      '-lavfi', `fps=${options.fps},scale=${options.width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer`,
      outputPath,
    ])
  }

  // Always run gifsicle optimization
  await execFileAsync('gifsicle', [
    '-O3',
    '--lossy=30',
    outputPath,
    '-o', finalPath,
  ])

  return finalPath
}
