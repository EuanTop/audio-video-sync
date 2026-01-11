/**
 * FFT (Fast Fourier Transform) 实现
 * 用于音频信号的频域分析和互相关计算
 */

export type Complex = [number, number]; // [real, imaginary]

/**
 * 将数组填充到 2 的幂次长度
 */
export function padToPowerOfTwo(arr: Float32Array, targetLength: number): Float32Array {
  const padded = new Float32Array(targetLength);
  padded.set(arr);
  return padded;
}

/**
 * 计算下一个 2 的幂次
 */
export function nextPowerOfTwo(n: number): number {
  return 1 << Math.ceil(Math.log2(n));
}

/**
 * Cooley-Tukey FFT 算法
 */
export function fft(input: Float32Array): Complex[] {
  const n = input.length;
  
  if (n === 1) {
    return [[input[0], 0]];
  }
  
  if (n & (n - 1)) {
    throw new Error('FFT 输入长度必须是 2 的幂次');
  }
  
  // 分离奇偶项
  const even = new Float32Array(n / 2);
  const odd = new Float32Array(n / 2);
  
  for (let i = 0; i < n / 2; i++) {
    even[i] = input[2 * i];
    odd[i] = input[2 * i + 1];
  }
  
  const evenFFT = fft(even);
  const oddFFT = fft(odd);
  
  const result: Complex[] = new Array(n);
  
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const twiddle: Complex = [Math.cos(angle), Math.sin(angle)];
    
    // 复数乘法: twiddle * oddFFT[k]
    const t: Complex = [
      twiddle[0] * oddFFT[k][0] - twiddle[1] * oddFFT[k][1],
      twiddle[0] * oddFFT[k][1] + twiddle[1] * oddFFT[k][0]
    ];
    
    result[k] = [evenFFT[k][0] + t[0], evenFFT[k][1] + t[1]];
    result[k + n / 2] = [evenFFT[k][0] - t[0], evenFFT[k][1] - t[1]];
  }
  
  return result;
}

/**
 * 逆 FFT
 */
export function ifft(input: Complex[]): Complex[] {
  const n = input.length;
  
  // 共轭
  const conjugated: Complex[] = input.map(([re, im]) => [re, -im]);
  
  // 转换为 Float32Array 进行 FFT
  const realPart = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    realPart[i] = conjugated[i][0];
  }
  
  // 对共轭进行 FFT（这里需要处理复数输入）
  const result = fftComplex(conjugated);
  
  // 共轭并除以 n
  return result.map(([re, im]) => [re / n, -im / n]);
}

/**
 * 复数输入的 FFT
 */
export function fftComplex(input: Complex[]): Complex[] {
  const n = input.length;
  
  if (n === 1) {
    return [input[0]];
  }
  
  if (n & (n - 1)) {
    throw new Error('FFT 输入长度必须是 2 的幂次');
  }
  
  const even: Complex[] = [];
  const odd: Complex[] = [];
  
  for (let i = 0; i < n / 2; i++) {
    even.push(input[2 * i]);
    odd.push(input[2 * i + 1]);
  }
  
  const evenFFT = fftComplex(even);
  const oddFFT = fftComplex(odd);
  
  const result: Complex[] = new Array(n);
  
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const twiddle: Complex = [Math.cos(angle), Math.sin(angle)];
    
    const t: Complex = [
      twiddle[0] * oddFFT[k][0] - twiddle[1] * oddFFT[k][1],
      twiddle[0] * oddFFT[k][1] + twiddle[1] * oddFFT[k][0]
    ];
    
    result[k] = [evenFFT[k][0] + t[0], evenFFT[k][1] + t[1]];
    result[k + n / 2] = [evenFFT[k][0] - t[0], evenFFT[k][1] - t[1]];
  }
  
  return result;
}

/**
 * 计算两个信号的互相关
 * 使用 FFT 加速: corr(a,b) = IFFT(FFT(a) * conj(FFT(b)))
 * 
 * @param signalA 参考信号
 * @param signalB 待对齐信号
 * @returns 互相关结果数组
 */
export function crossCorrelate(signalA: Float32Array, signalB: Float32Array): Float32Array {
  // 计算需要的 FFT 长度（两个信号长度之和的下一个 2 的幂次）
  const n = nextPowerOfTwo(signalA.length + signalB.length - 1);
  
  // 填充信号到相同长度
  const paddedA = padToPowerOfTwo(signalA, n);
  const paddedB = padToPowerOfTwo(signalB, n);
  
  // 计算 FFT
  const fftA = fft(paddedA);
  const fftB = fft(paddedB);
  
  // 计算 FFT(A) * conj(FFT(B))
  const product: Complex[] = fftA.map((a, i) => {
    const b = fftB[i];
    // a * conj(b) = (a.re * b.re + a.im * b.im) + i(a.im * b.re - a.re * b.im)
    return [
      a[0] * b[0] + a[1] * b[1],
      a[1] * b[0] - a[0] * b[1]
    ];
  });
  
  // 计算 IFFT
  const correlation = ifft(product);
  
  // 提取实部
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = correlation[i][0];
  }
  
  return result;
}

/**
 * 从互相关结果中找到最大峰值位置
 * 
 * @param correlation 互相关结果
 * @param signalBLength 信号 B 的原始长度
 * @returns 偏移量（正值表示 B 相对于 A 延迟，负值表示 B 领先）
 */
export function findPeakOffset(correlation: Float32Array, signalBLength: number): number {
  let maxValue = -Infinity;
  let maxIndex = 0;
  
  for (let i = 0; i < correlation.length; i++) {
    if (correlation[i] > maxValue) {
      maxValue = correlation[i];
      maxIndex = i;
    }
  }
  
  // 将索引转换为偏移量
  // 如果 maxIndex < signalBLength，则 B 相对于 A 延迟
  // 如果 maxIndex >= signalBLength，则需要从另一端计算
  const n = correlation.length;
  
  if (maxIndex > n / 2) {
    return maxIndex - n;
  }
  
  return maxIndex;
}

/**
 * 计算互相关的置信度（归一化相关系数）
 */
export function calculateConfidence(
  signalA: Float32Array,
  signalB: Float32Array,
  correlation: Float32Array,
  peakIndex: number
): number {
  const maxCorr = correlation[peakIndex < 0 ? correlation.length + peakIndex : peakIndex];
  
  // 计算信号的能量
  let energyA = 0;
  let energyB = 0;
  
  for (let i = 0; i < signalA.length; i++) {
    energyA += signalA[i] * signalA[i];
  }
  
  for (let i = 0; i < signalB.length; i++) {
    energyB += signalB[i] * signalB[i];
  }
  
  // 归一化相关系数
  const normFactor = Math.sqrt(energyA * energyB);
  
  if (normFactor === 0) return 0;
  
  return Math.abs(maxCorr) / normFactor;
}
