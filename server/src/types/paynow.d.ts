// Minimal types for the official Paynow SDK (it ships without declarations).
declare module 'paynow' {
  export class Payment {
    reference: string;
    authEmail: string;
    add(title: string, amount: number): Payment;
    total(): number;
  }
  export class InitResponse {
    success: boolean;
    status: string;
    error?: string;
    pollUrl?: string;
    instructions?: string;
  }
  export class StatusResponse {
    reference: string;
    amount: string;
    paynowReference: string;
    pollUrl: string;
    status: string;
    error?: string;
  }
  export class Paynow {
    constructor(integrationId?: string, integrationKey?: string, resultUrl?: string, returnUrl?: string);
    resultUrl: string;
    returnUrl: string;
    createPayment(reference: string, authEmail?: string): Payment;
    sendMobile(payment: Payment, phone: string, method: string): Promise<InitResponse | undefined>;
    pollTransaction(url: string): Promise<InitResponse>;
    parseStatusUpdate(body: string): StatusResponse;
    parseQuery(query: string): Record<string, string>;
    verifyHash(values: Record<string, string>): boolean;
  }
}
