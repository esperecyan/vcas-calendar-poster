import crypto from 'node:crypto';
import date from 'date-fns';
import * as tz from 'date-fns-tz';
import calendar from '@googleapis/calendar';
import drive from '@googleapis/drive';
import { TIME_ZONE } from './calendar.js';

export const FILENAME_PATTERN = /^[0-9]+(?:-[0-9]+)? (.+)\.[a-z]+$/iu;

const FOLDER_ID = '17F71Vl8D4xq4ncTb6CJbDOjOJjRayH36';

/**
 * 認証情報を取得します。
 * @returns {calendar.auth.GoogleAuth}
 */
export function getAuth()
{
	return new calendar.auth.GoogleAuth({
		scopes: [
			'https://www.googleapis.com/auth/calendar.events',
			'https://www.googleapis.com/auth/drive',
		],
		credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_SECRET_KEY),
	});
}

/**
 * 指定したフォルダ直下のフォルダ・ファイルの情報を取得します。
 * @param {drive.drive_v3.Drive} drive
 * @param {string} folderId
 * @returns {Promise.<drive.drive_v3.Schema$File[]>}
 */
async function listEntries(drive, folderId)
{
	const entries = [ ];
	let pageToken;
	do {
		const { nextPageToken, files } = (await drive.files.list({
			q: `'${folderId}' in parents`,
			fields: 'nextPageToken, files(id, name, md5Checksum)',
			pageToken,
		})).data;
		pageToken = nextPageToken;
		entries.push(...files);
	} while (pageToken);
	return entries;
}

/**
 * ファイルを取得します。
 * @param {drive.drive_v3.Drive} drive
 * @param {string} fileId
 * @returns {Promise.<import('node:stream').Readable>}
 */
async function fetchFile(drive, fileId)
{
	return (await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' })).data;
}

/**
 * ファイルのMD5ハッシュ値を計算します。
 * @param {Buffer} file
 * @returns {string}
 */
function hashMD5(file)
{
	const hash = crypto.createHash('md5');
	hash.update(file);
	return hash.digest('hex');
}

/**
 * Googleドライブの単一ファイルを更新します。
 * @param {calendar.auth.GoogleAuth} auth
 * @param {string} fileId
 * @param {string} mimeType
 * @param {import('node:stream').Readable} stream
 * @returns {Promise.<void>}
 */
export async function putFile(auth, fileId, mimeType, stream)
{
	await drive.drive({ version: 'v3', auth }).files.update({ fileId, media: { mimeType, body: stream } });
}

/**
 * 本日の絵柄を取得します。
 * @param {calendar.auth.GoogleAuth} auth
 * @param {Buffer} previousPictureHash
 * @returns {Promise.<{ stream: import('node:stream').Readable?; name: string }>}
 * 		絵柄の更新がなければ、`stream` プロパティに `null` を設定します。
 */
export async function fetchPicture(auth, previousPicture = null)
{
	const drv = drive.drive({ version: 'v3', auth });
	const files = (await listEntries(drv, FOLDER_ID))
		.filter(file => FILENAME_PATTERN.test(file.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	const file = files[(date.getDate(tz.utcToZonedTime(new Date(), TIME_ZONE)) - 1) % files.length];

	return {
		stream: !previousPicture || file.md5Checksum !== hashMD5(previousPicture)
			? await fetchFile(drv, file.id)
			: null,
		name: file.name,
	};
}
