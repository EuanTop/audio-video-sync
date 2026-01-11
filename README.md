# audio-video-sync

[![npm version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://www.npmjs.com/package/audio-video-sync)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

**English** | [中文版](./README.zh-CN.md)

---

🙆‍♀️ Multi-camera recording alignment timeline tool, **a must-have for research!**  

📱 Aligns via audio, bypassing the additional processing inconsistencies of video source data on Apple, Android, and Xiaomi devices, as well as the inherent inaccuracies of the recording equipment's system time.

✨ Multi-camera video synchronization using audio cross-correlation. Automatically align multiple video timelines by analyzing audio waveforms with millisecond precision.

![eg_img](<cover.png>)
## Features

- 🎯 **High Precision** - Millisecond-level sync accuracy (±2ms)
- ⚡ **High Performance** - FFT-accelerated cross-correlation algorithm
- 🌐 **Browser Native** - Based on FFmpeg.wasm, no server required
- 📦 **Zero Config** - Works out of the box with automatic audio extraction
- 🔧 **Flexible** - Supports custom FFmpeg instances and parameters
- 📝 **TypeScript** - Full type definitions included

## How it Works

Multi-camera recordings may have inaccurate creation_time metadata, but the ambient sound is consistent across all recordings. By performing cross-correlation analysis on audio waveforms, we can precisely calculate the time offset between videos.

```
Video A audio: ──────█████████████──────────
Video B audio: ────────────█████████████────
                          ↑
                      offset Δt
```

<!-- ## Requirements (uncertain)

- **Node.js**: >= 16.0.0
- **Browser**: Must support SharedArrayBuffer (Chrome 92+, Firefox 79+, Safari 15.2+)
- **HTTPS**: Required for SharedArrayBuffer in production -->

## Installation

```bash
npm install audio-video-sync @ffmpeg/ffmpeg @ffmpeg/util
```

## Development

### Clone and Setup

```bash
git clone https://github.com/yourusername/audio-video-sync.git
cd audio-video-sync
npm install
```

### Build from Source

```bash
# Build the package
npm run build

# This generates:
# - dist/index.js (CommonJS)
# - dist/index.esm.js (ES Module)
# - dist/index.d.ts (TypeScript definitions)
```

### Test the Build

```bash
# Open test.html in browser to test the built package
# npx serve -p 3333
open test.html
```

### Scripts

- `npm run build` - Build the package for distribution
- `npm run test` - Run tests (placeholder)
- `npm run prepublishOnly` - Automatically builds before publishing

## Quick Start

### Basic Usage

```javascript
import { syncVideos } from 'audio-video-sync';

const result = await syncVideos([
  { file: video1File, id: 'cam1' },
  { file: video2File, id: 'cam2' },
  { file: video3File, id: 'cam3' },
  { file: video4File, id: 'cam4' }
], {
  referenceIndex: 0,  // Use first video as reference
  sampleRate: 16000,  // Sample rate
  maxDuration: 60     // Only analyze first 60 seconds
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

### Using Existing FFmpeg Instance

```javascript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { AudioVideoSync } from 'audio-video-sync';

const ffmpeg = new FFmpeg();
await ffmpeg.load();

const sync = new AudioVideoSync(ffmpeg);
const result = await sync.syncVideos(videos);
```

### Calculate Offset Between Two Videos

```javascript
import { createSync } from 'audio-video-sync';

const sync = createSync();
const { offsetSeconds, confidence } = await sync.calculateOffset(
  referenceVideoFile,
  targetVideoFile
);

console.log(`Target video offset: ${offsetSeconds} seconds`);
console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);
```

### With Progress Callback

```javascript
const result = await syncVideos(videos, {
  onProgress: (stage, progress) => {
    if (stage === 'extracting') {
      console.log(`Extracting audio: ${(progress * 100).toFixed(0)}%`);
    } else if (stage === 'correlating') {
      console.log(`Computing correlation: ${(progress * 100).toFixed(0)}%`);
    }
  }
});
```

## API

### syncVideos(videos, options)

Synchronize multiple video files.

**Parameters:**
- `videos`: `VideoInput[]` - Array of video inputs
  - `file`: `File | Blob` - Video file
  - `id`: `string` (optional) - Video identifier
  - `originalStartTime`: `Date` (optional) - Original start time
- `options`: `SyncOptions` (optional)
  - `referenceIndex`: `number` - Reference video index, default 0
  - `sampleRate`: `number` - Sample rate, default 16000
  - `maxDuration`: `number` - Max analysis duration (seconds), default 60
  - `minConfidence`: `number` - Min confidence threshold, default 0.3
  - `onProgress`: `(stage, progress) => void` - Progress callback

**Returns:** `Promise<MultiSyncResult>`

### AudioVideoSync

Synchronizer class with FFmpeg instance reuse support.

```javascript
const sync = new AudioVideoSync(ffmpeg?);
await sync.load();
const result = await sync.syncVideos(videos, options);
const offset = await sync.calculateOffset(refVideo, targetVideo);
```

### Low-level API

```javascript
import { 
  extractAudio,       // Extract audio from video
  crossCorrelate,     // Compute cross-correlation
  findPeakOffset,     // Find peak offset
  calculateConfidence // Calculate confidence score
} from 'audio-video-sync';
```

## Types

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

## Accuracy Comparison

| Method | Accuracy |
|--------|----------|
| creation_time | ±seconds |
| File timestamp | ±100ms |
| Audio cross-correlation | **±2ms** |

## Notes

1. **Audio Quality**: Ensure videos have clear ambient sound; silent videos cannot be synced
2. **Sample Rate**: 16000 Hz is sufficient for sync; higher rates increase computation
3. **Analysis Duration**: Usually 30-60 seconds is enough; no need to process entire video
4. **Memory Usage**: For long videos, limit `maxDuration` to control memory usage
5. **Browser Compatibility**: Requires SharedArrayBuffer support

## Tech Stack

- FFmpeg.wasm - Video decoding and audio extraction
- FFT (Fast Fourier Transform) - Frequency domain cross-correlation
- TypeScript - Type safety

## Contributing

Issues and Pull Requests are welcome!

## License

[MIT](LICENSE)
