import date from 'date-fns';
import * as tz from 'date-fns-tz';
import calendar from '@googleapis/calendar';

export const TIME_ZONE = 'Asia/Tokyo';

const CALENDAR_ID = 'v4hhfbk90aur93dhddd5dmie4g@group.calendar.google.com';
const DATE_FORMAT
	= new Intl.DateTimeFormat('ja', { timeZone: TIME_ZONE, month: 'numeric', day: 'numeric', weekday: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('ja', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
/**
 * 指定日時をまたいで開始、終了するイベントを取得するために、指定した日付の前後に足す日にち。
 */
const MARGIN_DAYS = 30;

/**
 * 本日から1週間以内の予定を取得します。
 * @param {calendar.auth.GoogleAuth} auth
 * @returns {Promise.<Map.<string, string[]>>} 月/日と、時刻/タイトル一覧の連想配列。
 */
export async function fetchWeeklyEventDateTitlesPairs(auth)
{
	const startOfDay = tz.zonedTimeToUtc(date.startOfDay(tz.utcToZonedTime(new Date(), TIME_ZONE)), TIME_ZONE);

	const events = (await calendar.calendar({ version: 'v3', auth }).events.list({
		calendarId: CALENDAR_ID,
		singleEvents: true,
		timeMin: date.addDays(startOfDay, - MARGIN_DAYS).toISOString(),
		timeMax: date.addDays(startOfDay, 7 + MARGIN_DAYS).toISOString(),
	})).data.items;

	const dateTitlesPairs = new Map();
	const eventIds = [ ];
	for (let i = 0; i < 7; i++) {
		const currentDateTimestamp = date.addDays(startOfDay, i).getTime();
		const nextDateTimestamp = date.addDays(currentDateTimestamp, 1).getTime();

		const titles = [ ];
		for (const event of events.filter(function (event) {
			if (eventIds.includes(event.id)) {
				return false;
			}
			const startTimestamp = new Date(event.start.dateTime).getTime();
			const endTimestamp = new Date(event.end.dateTime).getTime();
			return startTimestamp < currentDateTimestamp
				? endTimestamp >= currentDateTimestamp // 前日以前に開始したイベント
				: startTimestamp < nextDateTimestamp;
		}).sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())) {
			titles.push((new Date(event.start.dateTime).getTime() < currentDateTimestamp
				? '       ↳'
				: TIME_FORMAT.format(new Date(event.start.dateTime)))
				+ ' ' + event.summary);
			eventIds.push(event.id);
		}

		dateTitlesPairs.set(DATE_FORMAT.format(currentDateTimestamp).replace('/', '月').replace('(', '日('), titles);
	}

	return dateTitlesPairs;
}
