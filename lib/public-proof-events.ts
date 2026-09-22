export const PUBLIC_PROOF_UPDATE_EVENT = "pulsercuit:proof-update";

export type PublicProofUpdateKind = "member" | "reward" | "payout";

export type PublicProofUpdateDetail = {
  kind: PublicProofUpdateKind;
  memberDelta: number;
  rewardEventDelta: number;
  paidWithdrawalDelta: number;
};
