export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface JobProgress {
  step: 'capturing' | 'encoding' | 'uploading'
  pct: number
}

export interface GifMeta {
  fileSize: number
  frameCount: number
}

export interface JobData {
  jobId: string
  url: string
  options: JobOptions
}

export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'full'

export interface JobOptions {
  width: number
  height: number
  fps: number
  duration: number
  quality: number
  frames: number
  ratio?: AspectRatio
}

export type GifPreset = 'thumbnail' | 'standard' | 'high' | 'mobile'

export const RATIO_VALUES: Record<AspectRatio, number | 'full'> = {
  '16:9': 9 / 16,
  '4:3': 3 / 4,
  '1:1': 1,
  '9:16': 16 / 9,
  'full': 'full'
}

export const PRESETS: Record<GifPreset, JobOptions> = {
  thumbnail: { width: 480, height: 300, fps: 4, duration: 2, quality: 70, frames: 8 },
  standard:  { width: 800, height: 500, fps: 6, duration: 3, quality: 80, frames: 12 },
  high:      { width: 1200, height: 750, fps: 8, duration: 3, quality: 90, frames: 15 },
  mobile:    { width: 375, height: 667, fps: 5, duration: 3, quality: 75, frames: 10 },
}

