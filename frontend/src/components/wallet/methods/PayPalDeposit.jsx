import React from "react";
import { FiatDeposit } from "./QRISDeposit";

export default function PayPalDeposit({ config, onSubmitted }) {
  const email = config?.paypal_email || "payments@example.com";
  return (
    <FiatDeposit
      method="paypal"
      currency="USD"
      label="PayPal"
      rate={config?.rate_usd_per_dl || 0.65}
      qrImage={null}
      recipient={{ label: "PayPal Email", value: email }}
      instructions={[
        `Send payment as "Friends & Family" to: ${email}`,
        "Use USD currency. Do NOT add fees.",
        "Screenshot the confirmation page and upload it below.",
        "Include the transaction ID in the reference field.",
      ]}
      onSubmitted={onSubmitted}
    />
  );
}
