# audio-video-sync

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/audio-video-sync)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

[English](./README.md) | **中文版**

---
🙆‍♀️  多机位录影对齐时间轴工具，**科研常备！**  
📱 通过音频对齐，绕开视频源数据在不同系统（苹果、安卓和小米）不一致的额外处理，以及录像设备系统时间本身就不正确的问题。
🌟 基于音频互相关的多机位视频同步库。使用 FFT 加速的互相关算法，通过分析音频波形自动对齐多个视频的时间轴，精度可达毫秒级。
![eg_img](<cover.png>)

## 特性

- 🎯 **高精度** - 毫秒级同步精度（±2ms）
- ⚡ **高性能** - FFT 加速的互相关算法
- 🌐 **浏览器原生** - 基于 FFmpeg.wasm，无需服务端
- 📦 **零配置** - 开箱即用，自动处理音频提取
- 🔧 **灵活** - 支持自定义 FFmpeg 实例和参数
- 📝 **TypeScript** - 完整的类型定义

## 原理

多机位录制的视频虽然 creation_time 可能不准确，但录制的环境声音是一致的。通过对音频波形进行互相关分析，可以精确计算出各视频之间的时间偏移。

```
视频A音频: ──────█████████████──────────
视频B音频: ────────────█████████████────
                      ↑
                  偏移量 Δt
```

<!-- ## 环境要求 (不确定)

- **Node.js**: >= 16.0.0
- **浏览器**: 需要支持 SharedArrayBuffer（Chrome 92+、Firefox 79+、Safari 15.2+）
- **HTTPS**: 生产环境需要 HTTPS 才能使用 SharedArrayBuffer -->

## 安装

```bash
npm install audio-video-sync @ffmpeg/ffmpeg @ffmpeg/util
```

## 开发

### 克隆和设置

```bash
git clone https://github.com/yourusername/audio-video-sync.git
cd audio-video-sync
npm install
```

### 从源码构建

```bash
# 构建包
npm run build

# 这会生成:
# - dist/index.js (CommonJS 格式)
# - dist/index.esm.js (ES Module 格式)
# - dist/index.d.ts (TypeScript 类型定义)
```

### 测试构建结果

```bash
# 在浏览器中打开 test.html 来测试构建的包
open test.html
```

### 脚本命令

- `npm run build` - 构建用于发布的包
- `npm run test` - 运行测试（占位符）
- `npm run prepublishOnly` - 发布前自动构建

## 快速开始

### 基本用法

```javascript
import { syncVideos } from 'audio-video-sync';

// 同步多个视频文件
const result = await syncVideos([
  { file: video1File, id: 'cam1' },
  { file: video2File, id: 'cam2' },
  { file: video3File, id: 'cam3' },
  { file: video4File, id: 'cam4' }
], {
  referenceIndex: 0,  // 以第一个视频为参考
  sampleRate: 16000,  // 采样率
  maxDuration: 60     // 只分析前60秒
});

console.log(result);
// {
//   referenceId: 'cam1',
//   results: [
//     { id: 'cam1', offsetSeconds: 0, confidence: 1 },
//     { id: 'cam2', offsetSeconds: 0.523, confidence: 0.89 },
//     { id: 'cam3', offsetSeconds: -0.127, confidence: 0.92 },
//     { id: 'cam4', offsetSeconds: 1.234, confidence: 0.85 }
//   ],
//   success: true
// }
```

### 使用已有的 FFmpeg 实例

```javascript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { AudioVideoSync } from 'audio-video-sync';

// 如果你的项目已经有 FFmpeg 实例
const ffmpeg = new FFmpeg();
await ffmpeg.load();

const sync = new AudioVideoSync(ffmpeg);
const result = await sync.syncVideos(videos);
```

### 计算两个视频的偏移

```javascript
import { createSync } from 'audio-video-sync';

const sync = createSync();
const { offsetSeconds, confidence } = await sync.calculateOffset(
  referenceVideoFile,
  targetVideoFile
);

console.log(`目标视频相对参考视频偏移: ${offsetSeconds} 秒`);
console.log(`置信度: ${(confidence * 100).toFixed(1)}%`);
```

### 带进度回调

```javascript
const result = await syncVideos(videos, {
  onProgress: (stage, progress) => {
    if (stage === 'extracting') {
      console.log(`提取音频: ${(progress * 100).toFixed(0)}%`);
    } else if (stage === 'correlating') {
      console.log(`计算相关: ${(progress * 100).toFixed(0)}%`);
    }
  }
});
```

### 与 RFID 数据对齐

```javascript
import { syncVideos } from 'audio-video-sync';

// 假设 cam1 的时间与 RFID 数据是对齐的
const videos = [
  { 
    file: cam1File, 
    id: 'cam1',
    originalStartTime: new Date('2024-01-11T10:00:00') // RFID 对齐的时间
  },
  { file: cam2File, id: 'cam2' },
  { file: cam3File, id: 'cam3' },
  { file: cam4File, id: 'cam4' }
];

const result = await syncVideos(videos, { referenceIndex: 0 });

// 所有视频都会得到校正后的开始时间
result.results.forEach(r => {
  console.log(`${r.id}: 校正后开始时间 = ${r.correctedStartTime}`);
});
```

## API

### syncVideos(videos, options)

同步多个视频文件。

**参数:**
- `videos`: `VideoInput[]` - 视频输入数组
  - `file`: `File | Blob` - 视频文件
  - `id`: `string` (可选) - 视频标识
  - `originalStartTime`: `Date` (可选) - 原始开始时间
- `options`: `SyncOptions` (可选)
  - `referenceIndex`: `number` - 参考视频索引，默认 0
  - `sampleRate`: `number` - 采样率，默认 16000
  - `maxDuration`: `number` - 最大分析时长（秒），默认 60
  - `minConfidence`: `number` - 最小置信度阈值，默认 0.3
  - `onProgress`: `(stage, progress) => void` - 进度回调

**返回:** `Promise<MultiSyncResult>`

### AudioVideoSync

同步器类，支持复用 FFmpeg 实例。

```javascript
const sync = new AudioVideoSync(ffmpeg?);
await sync.load();
const result = await sync.syncVideos(videos, options);
const offset = await sync.calculateOffset(refVideo, targetVideo);
```

### 底层 API

```javascript
import { 
  extractAudio,      // 从视频提取音频
  crossCorrelate,    // 计算互相关
  findPeakOffset,    // 找到峰值偏移
  calculateConfidence // 计算置信度
} from 'audio-video-sync';
```

## 类型定义

```typescript
interface VideoInput {
  file: File | Blob;
  id?: string;
  originalStartTime?: Date;
}

interface SyncResult {
  id: string;
  offsetSeconds: number;
  offsetSamples: number;
  confidence: number;
  correctedStartTime: Date | null;
}

interface MultiSyncResult {
  referenceId: string;
  results: SyncResult[];
  sampleRate: number;
  success: boolean;
  error?: string;
}
```

## 精度对比

| 方法 | 精度 |
|------|------|
| creation_time | ±秒级 |
| 文件时间戳 | ±百毫秒 |
| 音频互相关 | **±2ms** |

## 注意事项

1. **音频质量**: 确保视频有清晰的环境音，纯静音视频无法同步
2. **采样率**: 16000 Hz 足够用于同步，更高采样率会增加计算量
3. **分析时长**: 通常分析前 30-60 秒就足够，不需要处理整个视频
4. **内存占用**: 长视频建议限制 `maxDuration` 以控制内存使用
5. **浏览器兼容**: 需要支持 SharedArrayBuffer 的浏览器环境

## 技术栈

- FFmpeg.wasm - 视频解码和音频提取
- FFT (Fast Fourier Transform) - 频域互相关计算
- TypeScript - 类型安全

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](LICENSE)
