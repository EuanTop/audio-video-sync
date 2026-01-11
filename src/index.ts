/**
 * audio-video-sync
 * 
 * 基于音频互相关的多机位视频同步库
 * Multi-camera video synchronization using audio cross-correlation
 */

// 主同步接口
export {
  AudioVideoSync,
  createSync,
  syncVideos,
  type VideoInput,
  type SyncResult,
  type MultiSyncResult,
  type SyncOptions
} from './sync';

// 音频处理
export {
  extractAudio,
  preprocessAudio,
  downsample,
  audioBufferToFloat32,
  type AudioData,
  type ExtractOptions
} from './audio';

// FFT 和互相关算法
export {
  fft,
  ifft,
  crossCorrelate,
  findPeakOffset,
  calculateConfidence,
  nextPowerOfTwo,
  padToPowerOfTwo,
  type Complex
} from './fft';
