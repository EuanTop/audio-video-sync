/**
 * 多机位视频音频同步主模块
 * 
 * 使用音频互相关算法自动对齐多个视频的时间轴
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { extractAudio, preprocessAudio, ExtractOptions, AudioData } from './audio';
import { crossCorrelate, findPeakOffset, calculateConfidence } from './fft';

export interface VideoInput {
  /** 视频文件 */
  file: File | Blob;
  /** 视频标识（可选） */
  id?: string;
  /** 视频原始开始时间（如果有） */
  originalStartTime?: Date;
}

export interface SyncResult {
  /** 视频标识 */
  id: string;
  /** 相对于参考视频的时间偏移（秒），正值表示该视频延迟，负值表示领先 */
  offsetSeconds: number;
  /** 偏移量（采样点数） */
  offsetSamples: number;
  /** 同步置信度 (0-1)，越高表示匹配越可靠 */
  confidence: number;
  /** 校正后的开始时间 */
  correctedStartTime: Date | null;
}

export interface MultiSyncResult {
  /** 参考视频的标识 */
  referenceId: string;
  /** 各视频的同步结果 */
  results: SyncResult[];
  /** 采样率 */
  sampleRate: number;
  /** 同步是否成功 */
  success: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

export interface SyncOptions extends ExtractOptions {
  /** 参考视频索引，默认 0（第一个视频） */
  referenceIndex?: number;
  /** 最小置信度阈值，低于此值认为同步失败，默认 0.3 */
  minConfidence?: number;
  /** 进度回调 */
  onProgress?: (stage: string, progress: number) => void;
}

/**
 * 音频视频同步器
 */
export class AudioVideoSync {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;
  
  constructor(ffmpeg?: FFmpeg) {
    this.ffmpeg = ffmpeg || new FFmpeg();
  }
  
  /**
   * 加载 FFmpeg（如果尚未加载）
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    
    if (!this.ffmpeg.loaded) {
      await this.ffmpeg.load();
    }
    this.loaded = true;
  }
  
  /**
   * 同步多个视频
   * 
   * @param videos 视频文件数组
   * @param options 同步选项
   * @returns 同步结果
   */
  async syncVideos(
    videos: VideoInput[],
    options: SyncOptions = {}
  ): Promise<MultiSyncResult> {
    const {
      referenceIndex = 0,
      minConfidence = 0.3,
      onProgress,
      ...extractOptions
    } = options;
    
    if (videos.length < 2) {
      return {
        referenceId: videos[0]?.id || '0',
        results: [],
        sampleRate: extractOptions.sampleRate || 16000,
        success: false,
        error: '至少需要 2 个视频进行同步'
      };
    }
    
    if (referenceIndex < 0 || referenceIndex >= videos.length) {
      return {
        referenceId: '',
        results: [],
        sampleRate: extractOptions.sampleRate || 16000,
        success: false,
        error: '参考视频索引无效'
      };
    }
    
    try {
      await this.load();
      
      // 提取所有视频的音频
      const audioDataList: AudioData[] = [];
      
      for (let i = 0; i < videos.length; i++) {
        onProgress?.('extracting', (i + 1) / videos.length);
        const audio = await extractAudio(this.ffmpeg, videos[i].file, extractOptions);
        audioDataList.push(audio);
      }
      
      // 预处理音频
      const processedAudio = audioDataList.map(a => preprocessAudio(a.samples));
      
      // 获取参考音频
      const referenceAudio = processedAudio[referenceIndex];
      const referenceVideo = videos[referenceIndex];
      const sampleRate = audioDataList[referenceIndex].sampleRate;
      
      // 计算每个视频相对于参考视频的偏移
      const results: SyncResult[] = [];
      
      for (let i = 0; i < videos.length; i++) {
        onProgress?.('correlating', (i + 1) / videos.length);
        
        const video = videos[i];
        const videoId = video.id || i.toString();
        
        if (i === referenceIndex) {
          // 参考视频偏移为 0
          results.push({
            id: videoId,
            offsetSeconds: 0,
            offsetSamples: 0,
            confidence: 1,
            correctedStartTime: video.originalStartTime || null
          });
          continue;
        }
        
        const targetAudio = processedAudio[i];
        
        // 计算互相关
        const correlation = crossCorrelate(referenceAudio, targetAudio);
        
        // 找到峰值偏移
        const offsetSamples = findPeakOffset(correlation, targetAudio.length);
        const offsetSeconds = offsetSamples / sampleRate;
        
        // 计算置信度
        const confidence = calculateConfidence(
          referenceAudio,
          targetAudio,
          correlation,
          offsetSamples
        );
        
        // 计算校正后的开始时间
        let correctedStartTime: Date | null = null;
        if (referenceVideo.originalStartTime) {
          correctedStartTime = new Date(
            referenceVideo.originalStartTime.getTime() - offsetSeconds * 1000
          );
        }
        
        results.push({
          id: videoId,
          offsetSeconds,
          offsetSamples,
          confidence,
          correctedStartTime
        });
      }
      
      // 检查是否所有同步都成功
      const allSuccessful = results.every(r => r.confidence >= minConfidence);
      
      return {
        referenceId: referenceVideo.id || referenceIndex.toString(),
        results,
        sampleRate,
        success: allSuccessful,
        error: allSuccessful ? undefined : '部分视频同步置信度过低'
      };
      
    } catch (error) {
      return {
        referenceId: videos[referenceIndex]?.id || referenceIndex.toString(),
        results: [],
        sampleRate: extractOptions.sampleRate || 16000,
        success: false,
        error: error instanceof Error ? error.message : '同步过程发生错误'
      };
    }
  }
  
  /**
   * 计算两个视频之间的时间偏移
   * 
   * @param referenceVideo 参考视频
   * @param targetVideo 目标视频
   * @param options 提取选项
   * @returns 偏移结果
   */
  async calculateOffset(
    referenceVideo: File | Blob,
    targetVideo: File | Blob,
    options: ExtractOptions = {}
  ): Promise<{ offsetSeconds: number; confidence: number }> {
    await this.load();
    
    // 提取音频
    const refAudio = await extractAudio(this.ffmpeg, referenceVideo, options);
    const targetAudio = await extractAudio(this.ffmpeg, targetVideo, options);
    
    // 预处理
    const refProcessed = preprocessAudio(refAudio.samples);
    const targetProcessed = preprocessAudio(targetAudio.samples);
    
    // 计算互相关
    const correlation = crossCorrelate(refProcessed, targetProcessed);
    
    // 找到峰值
    const offsetSamples = findPeakOffset(correlation, targetProcessed.length);
    const offsetSeconds = offsetSamples / refAudio.sampleRate;
    
    // 计算置信度
    const confidence = calculateConfidence(
      refProcessed,
      targetProcessed,
      correlation,
      offsetSamples
    );
    
    return { offsetSeconds, confidence };
  }
}

/**
 * 创建同步器实例的便捷函数
 */
export function createSync(ffmpeg?: FFmpeg): AudioVideoSync {
  return new AudioVideoSync(ffmpeg);
}

/**
 * 快速同步多个视频（一次性使用）
 */
export async function syncVideos(
  videos: VideoInput[],
  options?: SyncOptions
): Promise<MultiSyncResult> {
  const sync = new AudioVideoSync();
  return sync.syncVideos(videos, options);
}
