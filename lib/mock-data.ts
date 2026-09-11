export type Offer = {
  id: string;
  title: string;
  category: "survey" | "quest" | "app";
  rewardUsd: number;
  minutes: number;
  match: number;
  completionRate: number;
  badge: string;
};

export const offers: Offer[] = [
  { id: "pulse-1", title: "Tell us what you stream", category: "survey", rewardUsd: 0.42, minutes: 4, match: 97, completionRate: 0.81, badge: "Fast" },
  { id: "pulse-2", title: "Try a new productivity app", category: "app", rewardUsd: 1.2, minutes: 9, match: 93, completionRate: 0.68, badge: "Popular" },
  { id: "pulse-3", title: "Complete the starter quest", category: "quest", rewardUsd: 0.74, minutes: 6, match: 89, completionRate: 0.76, badge: "Easy" },
  { id: "pulse-4", title: "Share your travel preferences", category: "survey", rewardUsd: 0.66, minutes: 7, match: 84, completionRate: 0.72, badge: "High success" },
];
