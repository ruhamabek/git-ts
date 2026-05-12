export function hexToRawBuffer(hex: string ): Buffer {
    return Buffer.from(hex, 'hex');
}