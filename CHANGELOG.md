# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-11

### Added
- Initial release
- `syncVideos()` - Synchronize multiple videos using audio cross-correlation
- `AudioVideoSync` class - Reusable synchronizer with FFmpeg instance management
- `createSync()` - Factory function for creating sync instances
- `calculateOffset()` - Calculate offset between two videos
- `extractAudio()` - Extract audio PCM data from video files
- `crossCorrelate()` - FFT-based cross-correlation algorithm
- `findPeakOffset()` - Find peak offset from correlation result
- `calculateConfidence()` - Calculate sync confidence score
- Full TypeScript support with type definitions
- Support for custom FFmpeg instances
- Progress callback support
- Configurable sample rate and max duration

### Technical Details
- Uses FFmpeg.wasm for browser-based audio extraction
- FFT-accelerated cross-correlation for fast processing
- Supports 16-bit PCM audio processing
- Automatic audio preprocessing (DC offset removal, normalization)
