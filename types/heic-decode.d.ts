declare module "heic-decode" {
  export default function decode(options: {
    buffer: ArrayBuffer | Uint8Array | Buffer;
  }): Promise<{
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }>;
}
