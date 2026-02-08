import type { SelectionFormatCounts } from '../types/video.js';
import { TIME } from './constants.js';

export const JST_UTC_OFFSET_HOURS = 9;
const JST_OFFSET_MS = JST_UTC_OFFSET_HOURS * TIME.HOUR_MS;

export const VIDEO_SELECTION_TRIGGER_MINUTE = 0;

export const ARTICLE_LOOKBACK_HOURS = 48;
export const PAST_VIDEO_LOOKBACK_HOURS = 36;

export const SOFT_DAILY_TOTAL = 12;
export const SOFT_FORMAT_TARGETS: SelectionFormatCounts = {
  single_short: 4,
  multi_short: 4,
  long: 4
};

export interface VideoSelectionTriggerDecision {
  utcHour: number;
  utcMinute: number;
  jstHour: number;
  jstMinute: number;
  isOddJstHour: boolean;
  isHourMark: boolean;
  shouldTrigger: boolean;
}

export interface JstDayWindow {
  currentTimeJST: string;
  dayStart: string;
  dayEndExclusive: string;
}

function toJstDate(referenceTime: Date): Date {
  return new Date(referenceTime.getTime() + JST_OFFSET_MS);
}

export function evaluateVideoSelectionTrigger(referenceTime: Date): VideoSelectionTriggerDecision {
  const jstTime = toJstDate(referenceTime);
  const utcHour = referenceTime.getUTCHours();
  const utcMinute = referenceTime.getUTCMinutes();
  const jstHour = jstTime.getUTCHours();
  const jstMinute = jstTime.getUTCMinutes();
  const isOddJstHour = jstHour % 2 === 1;
  const isHourMark = jstMinute === VIDEO_SELECTION_TRIGGER_MINUTE;

  return {
    utcHour,
    utcMinute,
    jstHour,
    jstMinute,
    isOddJstHour,
    isHourMark,
    shouldTrigger: isOddJstHour && isHourMark
  };
}

export function getJstDayWindow(referenceTime: Date): JstDayWindow {
  const jstTime = toJstDate(referenceTime);
  const jstDateString = jstTime.toISOString().slice(0, 10);
  const currentTimeJST = `${jstTime.toISOString().replace('T', ' ').substring(0, 19)} JST`;

  const nextDay = new Date(`${jstDateString}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDateString = nextDay.toISOString().slice(0, 10);

  return {
    currentTimeJST,
    dayStart: `${jstDateString} 00:00:00`,
    dayEndExclusive: `${nextDateString} 00:00:00`
  };
}

export function calculateRemainingTargets(formatsToday: SelectionFormatCounts): SelectionFormatCounts {
  return {
    single_short: Math.max(0, SOFT_FORMAT_TARGETS.single_short - formatsToday.single_short),
    multi_short: Math.max(0, SOFT_FORMAT_TARGETS.multi_short - formatsToday.multi_short),
    long: Math.max(0, SOFT_FORMAT_TARGETS.long - formatsToday.long)
  };
}
