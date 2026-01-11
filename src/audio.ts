/**
 * 音频提取模块
 * 使用 FFmpeg.wasm 从视频文件中提取音频 PCM 数据
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface AudioData {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
  channels: number;
}

export interface ExtractOptions {
  /** 目标采样率，默认 16000 Hz（足够用于同步，且计算快） */
  sampleRate?: number;
  /** 是否转为单声道，默认 true */
  mono?: boolean;
  /** 只提取前 N 秒用于同步（节省内存和计算），默认 60 秒 */
  maxDuration?: number;
}

const DEFAULT_OPTIONS: Required<ExtractOptions> = {
  sampleRate: 16000,
  mono: true,
  maxDuration: 60
};

/**
 * 从视频文件提取音频 PCM 数据
 * 
 * @param ffmpeg 已加载的 FFmpeg 实例
 * @param videoFile 视频文件（File 或 Blob）
 * @param options 提取选项
 * @returns 音频 PCM 数据
 */
export async function extractAudio(
  ffmpeg: FFmpeg,
  videoFile: File | Blob,
  options: ExtractOptions = {}
): Promise<AudioData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const inputName = 'input_video';
  const outputName = 'output_audio.pcm';
  
  // 写入输入文件
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
  
  // 构建 FFmpeg 命令
  const args = [
    '-i', inputName,
    '-vn',                          // 不处理视频
    '-ac', opts.mono ? '1' : '2',   // 声道数
    '-ar', opts.sampleRate.toString(), // 采样率
    '-f', 's16le',                  // 16位小端 PCM
    '-t', opts.maxDuration.toString(), // 最大时长
    outputName
  ];
  
  await ffmpeg.exec(args);
  
  // 读取输出文件
  const data = await ffmpeg.readFile(outputName);
  const pcmData = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);
  
  // 清理临时文件
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  
  // 将 16 位 PCM 转换为 Float32Array
  const samples = pcm16ToFloat32(pcmData);
  
  return {
    samples,
    sampleRate: opts.sampleRate,
    duration: samples.length / opts.sampleRate,
    channels: opts.mono ? 1 : 2
  };
}

/**
 * 将 16 位 PCM 数据转换为 Float32Array（归一化到 -1 到 1）
 */
function pcm16ToFloat32(pcmData: Uint8Array): Float32Array {
  const numSamples = pcmData.length / 2;
  const float32 = new Float32Array(numSamples);
  const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  
  for (let i = 0; i < numSamples; i++) {
    // 读取 16 位有符号整数（小端）
    const int16 = view.getInt16(i * 2, true);
    // 归一化到 -1 到 1
    float32[i] = int16 / 32768;
  }
  
  return float32;
}

/**
 * 从 AudioBuffer 获取 PCM 数据（用于 Web Audio API）
 */
export function audioBufferToFloat32(audioBuffer: AudioBuffer): Float32Array {
  // 如果是多声道，混合为单声道
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  const numChannels = audioBuffer.numberOfChannels;
  
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mixed[i] += channelData[i] / numChannels;
    }
  }
  
  return mixed;
}

/**
 * 对音频数据进行降采样
 */
export function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) {
    return samples;
  }
  
  const ratio = fromRate / toRate;
  const newLength = Math.floor(samples.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    result[i] = samples[srcIndex];
  }
  
  return result;
}

/**
 * 对音频应用简单的预处理（去直流偏移、归一化）
 */
export function preprocessAudio(samples: Float32Array): Float32Array {
  const result = new Float32Array(samples.length);
  
  // 计算均值（直流偏移）
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;
  
  // 去除直流偏移并找最大值
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] - mean;
    maxAbs = Math.max(maxAbs, Math.abs(result[i]));
  }
  
  // 归一化
  if (maxAbs > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= maxAbs;
    }
  }
  
  return result;
}
