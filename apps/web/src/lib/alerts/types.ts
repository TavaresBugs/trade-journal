/**
 * TradingView 1:1 Alerts System Types
 */

export type AlertConditionType =
  | "crossing"
  | "crossing_up"
  | "crossing_down"
  | "greater_than"
  | "less_than"
  | "entering_channel"
  | "exiting_channel"
  | "inside_channel"
  | "outside_channel"
  | "moving_up"
  | "moving_down"
  | "moving_up_percent"
  | "moving_down_percent";

export const ALERT_CONDITION_LABELS: Record<AlertConditionType, string> = {
  crossing: "Crossing",
  crossing_up: "Crossing Up",
  crossing_down: "Crossing Down",
  greater_than: "Greater Than",
  less_than: "Less Than",
  entering_channel: "Entering Channel",
  exiting_channel: "Exiting Channel",
  inside_channel: "Inside Channel",
  outside_channel: "Outside Channel",
  moving_up: "Moving Up",
  moving_down: "Moving Down",
  moving_up_percent: "Moving Up %",
  moving_down_percent: "Moving Down %",
};

export function formatConditionLabel(type?: AlertConditionType): string {
  if (!type) return "Crossing";
  return ALERT_CONDITION_LABELS[type] ?? "Crossing";
}

export type AlertFrequency =
  | "once_only"
  | "every_time"
  | "once_per_bar"
  | "once_per_bar_close";

export type AlertStatus = "active" | "triggered" | "paused";

export type AlertSoundName =
  // CLASSIC
  | "fired"
  | "3_notes_reverb"
  | "alarm_clock"
  | "beep_beep"
  | "call"
  | "chirpy"
  | "fault"
  | "hand_bell"
  // SOFT
  | "banjo"
  | "droplet"
  | "flickering"
  | "hoarse"
  | "knock_knock"
  | "promise"
  | "trumpets"
  | "you_win"
  // NATURE
  | "bullfrog"
  | "cat"
  | "dog"
  | "raven"
  | "rooster"
  | "thunder"
  | "water_drop"
  | "whale"
  // VOICES
  | "attention"
  | "guess_what"
  | "hey_pssst"
  | "hey_take_a_look"
  | "hey"
  | "look_at_me"
  | "sexy_mmm"
  | "oh"
  // FUNNY
  | "applause"
  | "breaking_glass"
  | "cash_register"
  | "chimes_power_down"
  | "dramatic_one_note"
  | "jackpot"
  | "man_laughing"
  | "martian_gun";

export interface AlertNotificationOptions {
  showPopup: boolean;
  sendToast: boolean;
  playSound: boolean;
  soundName: AlertSoundName;
  soundDurationSeconds: number; // 0 = play once, >0 = repeat for N seconds
  webhookUrl?: string;
  email?: boolean;
}

export interface ChartAlert {
  id: string;
  symbol: string;
  conditionType: AlertConditionType;
  targetPrice: number;
  upperPrice?: number;
  lowerPrice?: number;
  frequency: AlertFrequency;
  expiration: string; // ISO 8601 string
  message: string;
  notifications: AlertNotificationOptions;
  status: AlertStatus;
  createdAt: number;
  lastFiredAt?: number;
  fireCount: number;
}

export interface AlertLogItem {
  id: string;
  alertId: string;
  symbol: string;
  firedPrice: number;
  conditionType: AlertConditionType;
  message: string;
  timestamp: number;
}

export interface AlertSoundMetadata {
  id: AlertSoundName;
  label: string;
  filename: string;
  path: string;
}
