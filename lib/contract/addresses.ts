/**
 * Deployed contract addresses on Studionet (chain 61999).
 * Populated by scripts/deploy.ts after a real deployment. Do not hardcode a
 * placeholder address here and call it "deployed" — an unset address means
 * the app correctly reports NOT_DEPLOYED rather than fabricating state.
 */
export const NOTARY_ADDRESS = (process.env.NEXT_PUBLIC_NOTARY_ADDRESS ?? "") as `0x${string}` | "";
export const GATE_ADDRESS = (process.env.NEXT_PUBLIC_GATE_ADDRESS ?? "") as `0x${string}` | "";

export function requireAddress(value: string, label: string): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not configured. Set it in .env.local after deployment.`);
  }
  return value as `0x${string}`;
}
