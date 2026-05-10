import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiConfig } from "../config/config.js";

export type PaytrCheckoutTokenInput = {
  email: string;
  merchantOid: string;
  paymentAmountMinor: number;
  planDisplayName: string;
  userIp: string;
  userName: string;
  okUrl: string;
  failUrl: string;
  currency?: "TL";
  lang?: "tr" | "en";
};

export type PaytrCheckoutTokenResult = {
  token: string;
};

export type PaytrCheckoutAdapter = {
  createCheckoutToken: (
    input: PaytrCheckoutTokenInput,
  ) => Promise<PaytrCheckoutTokenResult>;
};

export function createPaytrCheckoutAdapter(
  config: ApiConfig,
): PaytrCheckoutAdapter {
  if (config.paytrProviderMode === "disabled") {
    throw new Error("PayTR checkout is disabled");
  }

  return {
    async createCheckoutToken(input) {
      const currency = input.currency ?? "TL";
      const testMode = config.paytrProviderMode === "sandbox" ? "1" : "0";
      const userBasket = encodePaytrBasket([
        [
          input.planDisplayName,
          formatMinorAsPaytrPrice(input.paymentAmountMinor),
          1,
        ],
      ]);
      const noInstallment = "1";
      const maxInstallment = "0";
      const hashString = [
        config.paytrMerchantId,
        input.userIp,
        input.merchantOid,
        input.email,
        String(input.paymentAmountMinor),
        userBasket,
        noInstallment,
        maxInstallment,
        currency,
        testMode,
      ].join("");
      const paytrToken = hmacBase64(
        `${hashString}${config.paytrMerchantSalt}`,
        config.paytrMerchantKey!,
      );
      const body = new URLSearchParams({
        merchant_id: config.paytrMerchantId!,
        user_ip: input.userIp,
        merchant_oid: input.merchantOid,
        email: input.email,
        payment_amount: String(input.paymentAmountMinor),
        paytr_token: paytrToken,
        user_basket: userBasket,
        debug_on: config.paytrProviderMode === "sandbox" ? "1" : "0",
        no_installment: noInstallment,
        max_installment: maxInstallment,
        user_name: input.userName,
        user_address: "Not collected for SaaS subscription checkout",
        user_phone: "0000000000",
        merchant_ok_url: input.okUrl,
        merchant_fail_url: input.failUrl,
        timeout_limit: "30",
        currency,
        test_mode: testMode,
        lang: input.lang ?? "tr",
      });

      const response = await fetch(config.paytrTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      const payload = (await response.json()) as {
        status?: string;
        token?: string;
        reason?: string;
      };
      if (!response.ok || payload.status !== "success" || !payload.token) {
        throw new Error(
          payload.reason ?? "PayTR checkout token request failed",
        );
      }
      return { token: payload.token };
    },
  };
}

export function createFixturePaytrCheckoutAdapter(): PaytrCheckoutAdapter {
  return {
    async createCheckoutToken(input) {
      return {
        token: `fixture_${Buffer.from(input.merchantOid).toString("base64url")}`,
      };
    },
  };
}

export function verifyPaytrWebhookHash(
  input: {
    merchantOid: string;
    status: string;
    totalAmount: string;
    hash: string;
  },
  config: Pick<ApiConfig, "paytrMerchantKey" | "paytrMerchantSalt">,
): boolean {
  const expected = hmacBase64(
    `${input.merchantOid}${config.paytrMerchantSalt}${input.status}${input.totalAmount}`,
    config.paytrMerchantKey!,
  );
  return safeEqual(expected, input.hash);
}

export function hmacBase64(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64");
}

function encodePaytrBasket(items: Array<[string, string, number]>): string {
  return Buffer.from(JSON.stringify(items), "utf8").toString("base64");
}

function formatMinorAsPaytrPrice(value: number): string {
  return (value / 100).toFixed(2);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
