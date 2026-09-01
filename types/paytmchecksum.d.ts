declare module "paytmchecksum" {
  export default class PaytmChecksum {
    static generateSignature(params: string | Record<string, unknown>, key: string): Promise<string>;
    static verifySignature(
      params: string | Record<string, unknown>,
      key: string,
      checksum: string,
    ): Promise<boolean>;
  }
}