import {
  differenceInMinutes,
  differenceInSeconds,
  isToday,
  isYesterday,
  isSameYear,
  format,
} from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { UserPublic } from '@/types';
import { Lang } from './i18n';

export interface UserStatusInfo {
  text: string;
  isOnline: boolean;
}

export function formatUserStatus(user?: UserPublic | null, lang: Lang = 'ru'): UserStatusInfo {
  if (!user) {
    if (lang === 'ky') return { text: 'офлайн', isOnline: false };
    if (lang === 'en') return { text: 'offline', isOnline: false };
    return { text: 'офлайн', isOnline: false };
  }

  if (user.is_online) {
    if (lang === 'ky') return { text: 'тармакта', isOnline: true };
    if (lang === 'en') return { text: 'online', isOnline: true };
    return { text: 'в сети', isOnline: true };
  }

  const defaultRecent =
    lang === 'ky' ? 'жакында эле болгон' : lang === 'en' ? 'last seen recently' : 'был(а) недавно';

  if (!user.last_seen) {
    return { text: defaultRecent, isOnline: false };
  }

  try {
    const date = new Date(user.last_seen);
    if (isNaN(date.getTime())) {
      return { text: defaultRecent, isOnline: false };
    }

    const now = new Date();
    const diffSec = differenceInSeconds(now, date);

    if (diffSec < 60) {
      if (lang === 'ky') return { text: 'жаңы эле болгон', isOnline: false };
      if (lang === 'en') return { text: 'last seen just now', isOnline: false };
      return { text: 'был(а) только что', isOnline: false };
    }

    const diffMin = differenceInMinutes(now, date);
    if (diffMin < 60) {
      if (lang === 'ky') {
        return { text: `${diffMin} мүнөт мурун болгон`, isOnline: false };
      }
      if (lang === 'en') {
        return { text: `last seen ${diffMin}m ago`, isOnline: false };
      }
      const minutesWord = getMinutesDeclension(diffMin);
      return { text: `был(а) ${diffMin} ${minutesWord} назад`, isOnline: false };
    }

    const dateLocale = lang === 'en' ? enUS : ru;
    const timeStr = format(date, 'HH:mm', { locale: dateLocale });

    if (isToday(date)) {
      if (lang === 'ky') return { text: `бүгүн саат ${timeStr}`, isOnline: false };
      if (lang === 'en') return { text: `last seen today at ${timeStr}`, isOnline: false };
      return { text: `был(а) сегодня в ${timeStr}`, isOnline: false };
    }

    if (isYesterday(date)) {
      if (lang === 'ky') return { text: `кечээ саат ${timeStr}`, isOnline: false };
      if (lang === 'en') return { text: `last seen yesterday at ${timeStr}`, isOnline: false };
      return { text: `был(а) вчера в ${timeStr}`, isOnline: false };
    }

    if (isSameYear(date, now)) {
      const dayMonth = format(date, 'd MMMM', { locale: dateLocale });
      if (lang === 'ky') return { text: `${dayMonth} саат ${timeStr}`, isOnline: false };
      if (lang === 'en') return { text: `last seen ${dayMonth} at ${timeStr}`, isOnline: false };
      return { text: `был(а) ${dayMonth} в ${timeStr}`, isOnline: false };
    }

    const fullDate = format(date, 'dd.MM.yyyy', { locale: dateLocale });
    if (lang === 'ky') return { text: `${fullDate} саат ${timeStr}`, isOnline: false };
    if (lang === 'en') return { text: `last seen ${fullDate} at ${timeStr}`, isOnline: false };
    return { text: `был(а) ${fullDate} в ${timeStr}`, isOnline: false };
  } catch {
    return { text: defaultRecent, isOnline: false };
  }
}

function getMinutesDeclension(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'минут';
  if (mod10 === 1) return 'минуту';
  if (mod10 >= 2 && mod10 <= 4) return 'минуты';
  return 'минут';
}
